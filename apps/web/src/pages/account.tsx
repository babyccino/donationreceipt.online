import { BriefcaseIcon, MapPinIcon } from "@heroicons/react/24/solid"
import { and, desc, eq, isNotNull } from "drizzle-orm"
import { Button, Card, Spinner } from "flowbite-react"
import { GetServerSideProps } from "next"
import { Session, getServerSession } from "next-auth"
import { signIn } from "next-auth/react"
import { ApiError } from "next/dist/server/api-utils"
import Image from "next/image"
import { useRouter } from "next/router"
import { useMemo, useState } from "react"

import { LayoutProps } from "@/components/layout"
import { Connect } from "@/components/qbo"
import { LoadingButton, PricingCard } from "@/components/ui"
import { signInRedirect } from "@/lib/auth/next-auth-helper-server"
import { config } from "@/lib/env"
import { SupportedCurrencies, getCurrency } from "@/lib/intl"
import { isUserSubscribed } from "@/lib/stripe"
import { getAccountList, interceptGetServerSidePropsErrors } from "@/lib/util/get-server-side-props"
import { SerialiseDates, deSerialiseDates, serialiseDates } from "@/lib/util/nextjs-helper"
import { subscribe } from "@/lib/util/request"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { DisconnectBody } from "@/pages/api/auth/disconnect"
import { DataType } from "@/pages/api/stripe/update-subscription"
import { Subscription as DbSubscription, accounts, db, sessions, users } from "db"
import { getDaysBetweenDates } from "utils/dist/date"
import { getImageUrl } from "utils/dist/db-helper"
import { fetchJsonData } from "utils/dist/request"

type Subscription = Pick<
  DbSubscription,
  "status" | "cancelAtPeriodEnd" | "currentPeriodEnd" | "createdAt"
>
type Props = ({
  session: Session
  name: string
  smallLogo: string | null
  companyName: string | null
  connected: boolean
  realmId: string | null
  currency: SupportedCurrencies
} & (
  | { subscribed: false }
  | {
      subscribed: true
      subscription: Subscription
    }
)) &
  LayoutProps
type SerialisedProps = SerialiseDates<Props>

const formatDate = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })

function ProfileCard({
  companyName,
  smallLogo,
  name,
  subscription,
  connected,
  realmId,
  session,
}: {
  name: string
  smallLogo: string | null
  companyName: string | null
  subscription?: Subscription
  connected: boolean
  realmId: string | null
  session: Session
}) {
  const router = useRouter()

  if (!session) throw new Error("User accessed account page while not signed in")

  return (
    <Card className="w-72">
      {Boolean(smallLogo) && (
        <Image
          src={smallLogo as string}
          alt={`${companyName}'s logo`}
          height={50}
          width={50}
          className="rounded-md"
        />
      )}
      <h5 className="text-xl font-medium text-gray-500 dark:text-white">{name}</h5>
      <div className="space-y-1">
        {companyName && (
          <div className="text-sm font-normal leading-tight text-gray-500 dark:text-gray-400">
            <div className="mb-[-0.1rem] mr-2 inline-block h-4 w-4 text-white">
              <BriefcaseIcon />
            </div>
            {companyName}
          </div>
        )}
        <div className="text-sm font-normal leading-tight text-gray-500 dark:text-gray-400">
          <div className="mb-[-0.1rem] mr-2 inline-block h-4 w-4 text-white">
            <MapPinIcon />
          </div>
          CA
        </div>
      </div>
      {subscription && (
        <>
          <p className="text-sm font-normal leading-tight text-gray-500 dark:text-gray-400">
            Subscribed since:{" "}
            <span className="text-gray-900 dark:text-white">
              {formatDate(new Date(subscription.createdAt))}
            </span>
          </p>
          <p className="text-sm font-normal leading-tight text-gray-500 dark:text-gray-400">
            Your subscription will {subscription!.cancelAtPeriodEnd ? "end" : "automatically renew"}{" "}
            in{" "}
            <span className="text-gray-900 dark:text-white">
              {getDaysBetweenDates(new Date(), new Date(subscription.currentPeriodEnd))}
            </span>{" "}
            days
          </p>
          <Button
            color={subscription.cancelAtPeriodEnd ? "blue" : "dark"}
            className="flex-shrink"
            onClick={async e => {
              e.preventDefault()
              const data: DataType = { cancelAtPeriodEnd: !subscription.cancelAtPeriodEnd }
              await fetchJsonData("/api/stripe/update-subscription", { method: "PUT", body: data })
              router.push(router.asPath)
            }}
          >
            {subscription.cancelAtPeriodEnd ? "Resubscribe" : "Unsubscribe"}
          </Button>
        </>
      )}
      {connected ? (
        <LoadingButton
          // this is the only colour which seems to work other than "blue" and I can't be bothered to fix it
          loadingImmediately
          color="dark"
          className="flex-shrink"
          onClick={async () => {
            const body: DisconnectBody = { redirect: false }
            const res = await fetchJsonData(
              `/api/auth/disconnect?revoke=true${realmId ? `&realmId=${realmId}` : ""}`,
              { method: "POST", body },
            )
            router.push("/auth/disconnected?callback=account")
          }}
        >
          Disconnect
        </LoadingButton>
      ) : (
        <ConnectButton />
      )}
    </Card>
  )
}

function ConnectButton() {
  const [loading, setLoading] = useState(false)

  return (
    <button
      className="relative flex-shrink self-center"
      onClick={async _ => {
        setLoading(true)
        try {
          await signIn("QBO")
          // only stop the spinner if there is an error
        } catch (e) {
          setLoading(false)
          throw e
        }
      }}
    >
      {loading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      )}
      <Connect />
    </button>
  )
}

// --- page ---

export default function AccountPage(serialisedProps: SerialisedProps) {
  const props = useMemo(() => deSerialiseDates(serialisedProps), [serialisedProps])
  const { subscribed, connected, name, companyName, smallLogo, realmId, session } = props
  return (
    <section className="flex min-h-screen flex-col p-4 sm:flex-row sm:justify-center sm:p-10">
      <div className="border-b border-solid border-slate-700 pb-8 text-white sm:border-b-0 sm:border-r sm:p-14">
        <PricingCard
          title="Your selected plan"
          plan={subscribed ? "pro" : "free"}
          button={
            !subscribed ? (
              <LoadingButton
                loadingImmediately
                onClick={e => {
                  e.preventDefault()
                  subscribe("/account")
                }}
                color="blue"
                className="transition duration-100"
              >
                Go pro
              </LoadingButton>
            ) : undefined
          }
          currency={props.currency}
        />
      </div>
      <div className="pt-8 text-white sm:p-14">
        <ProfileCard
          companyName={companyName}
          smallLogo={smallLogo}
          name={name}
          subscription={subscribed ? props.subscription : undefined}
          connected={connected}
          realmId={realmId}
          session={session}
        />
      </div>
    </section>
  )
}

// --- server-side props ---

const _getServerSideProps: GetServerSideProps<SerialisedProps> = async ({ req, res }) => {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return signInRedirect("account")

  const [user, [accountSwitched, accountList]] = await Promise.all([
    db.query.users.findFirst({
      // if the realmId is specified get that account otherwise just get the first account for the user
      where: eq(users.id, session.user.id),
      columns: { name: true, country: true },
      with: {
        accounts: {
          where: session.accountId
            ? eq(accounts.id, session.accountId)
            : eq(accounts.scope, "accounting"),
          columns: {
            id: true,
            scope: true,
            realmId: true,
          },
          with: {
            doneeInfo: { columns: { companyName: true, smallLogo: true } },
          },
          orderBy: desc(accounts.updatedAt),
        },
        billingAddress: { columns: { name: true } },
        subscription: {
          columns: {
            cancelAtPeriodEnd: true,
            status: true,
            createdAt: true,
            currentPeriodEnd: true,
          },
        },
      },
    }),
    getAccountList(session),
  ])

  // this shouldn't really happen as the user should have been automatically signed into one of their connected accounts
  if (accountSwitched) {
    return { redirect: { destination: "/account", permanent: false } }
  }

  if (!user) throw new ApiError(500, "user not found in db")
  let account = user.accounts?.[0] as (typeof user.accounts)[number] | undefined
  if (session.accountId && !account)
    throw new ApiError(500, "account for given user and session not found in db")

  // if the session does not specify an account but there is a connected account
  // then the session is connected to one of these accounts
  if (!session.accountId && account) {
    session.accountId = account.id
    await db
      .update(sessions)
      .set({ accountId: account.id })
      .where(eq(sessions.userId, session.user.id))
  }

  const { billingAddress, subscription } = user
  const doneeInfo = account?.doneeInfo
  const connected = account?.scope === "accounting"
  const realmId = account?.realmId ?? null

  const smallLogo = doneeInfo?.smallLogo
    ? getImageUrl(doneeInfo.smallLogo, config.firebaseProjectId, config.firebaseStorageEmulatorHost)
    : null
  const companyName = doneeInfo?.companyName ?? null
  const name = billingAddress?.name ?? user.name ?? ""
  const selectedAccountId = account?.id ?? null
  if (subscription && isUserSubscribed(subscription)) {
    return {
      props: serialiseDates({
        session,
        subscribed: true,
        subscription,
        companyName,
        smallLogo,
        name,
        connected,
        realmId,
        companies: accountList,
        selectedAccountId,
        currency: getCurrency(user.country),
      } satisfies Props),
    }
  }
  return {
    props: {
      session,
      subscribed: false,
      companyName,
      smallLogo,
      name,
      connected,
      realmId,
      companies: accountList,
      selectedAccountId,
      currency: getCurrency(user.country),
    } satisfies SerialisedProps,
  }
}
export const getServerSideProps = interceptGetServerSidePropsErrors(_getServerSideProps)
