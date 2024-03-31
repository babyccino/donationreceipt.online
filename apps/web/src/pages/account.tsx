import { Button } from "components/dist/ui/button"
import { Spinner } from "components/dist/ui/spinner"
import { and, asc, desc, eq, isNotNull } from "drizzle-orm"
import { GetServerSideProps } from "next"
import { Session, getServerSession } from "next-auth"
import { signIn } from "next-auth/react"
import Image from "next/image"
import { useRouter } from "next/router"
import { useMemo, useState } from "react"

import { DataType as SwitchCompanyDataType } from "@/pages/api/switch-company"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "components/dist/ui/table"
import { LayoutProps } from "@/components/layout"
import { Connect } from "@/components/qbo"
import { LoadingButton } from "@/components/ui"
import { signInRedirect } from "@/lib/auth/next-auth-helper-server"
import { config } from "@/lib/env"
import { SupportedCurrencies, getCurrency } from "@/lib/intl"
import { isUserSubscribed } from "@/lib/stripe"
import { interceptGetServerSidePropsErrors } from "@/lib/util/get-server-side-props"
import { SerialiseDates, deSerialiseDates, serialiseDates } from "@/lib/util/nextjs-helper"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { DisconnectBody } from "@/pages/api/auth/disconnect"
import { DataType } from "@/pages/api/stripe/update-subscription"
import { Subscription as DbSubscription, accounts, db, sessions, users } from "db"
import { getDaysBetweenDates } from "utils/dist/date"
import { getImageUrl } from "utils/dist/db-helper"
import { ApiError } from "utils/dist/error"
import { fetchJsonData } from "utils/dist/request"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "components/dist/ui/dropdown-menu"
import { DotsHorizontalIcon } from "@radix-ui/react-icons"

type Subscription = Pick<
  DbSubscription,
  "status" | "cancelAtPeriodEnd" | "currentPeriodEnd" | "createdAt"
>
type Company = {
  companyName: string
  realmId: string
  id: string
  scope: "accounting" | "profile"
  createdAt: Date
}
type Companies = Company[] | null
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
  Omit<LayoutProps, "companies"> & {
    companies?: Companies
  }
type SerialisedProps = SerialiseDates<Props>

const formatDate = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })

// not using the <LoadingButton /> component because it doesn't work with the <Connect /> component
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

function mapCompany(company: Company) {
  const connected = company.scope === "accounting"
  return (
    <TableRow key={company.id}>
      <TableCell>{company.companyName}</TableCell>
      <TableCell>{company.realmId}</TableCell>
      <TableCell className="pt-3">
        <span
          className={
            "rounded-lg p-2 font-mono " +
            (connected
              ? "text-muted-foreground bg-muted"
              : "text-destructive-foreground bg-destructive")
          }
        >
          {connected ? "connected" : "disconnected"}
        </span>
      </TableCell>
      <TableCell>{formatDate(company.createdAt)}</TableCell>
      <TableCell>
        <ActionsDropdown accountId={company.id} realmId={company.realmId} />
      </TableCell>
    </TableRow>
  )
}

function ActionsDropdown({ accountId, realmId }: { accountId: string; realmId: string }) {
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <DotsHorizontalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="w-full cursor-pointer">
          <Button
            variant="ghost"
            onClick={async () => {
              const res = await fetchJsonData("/api/switch-company", {
                method: "POST",
                body: { accountId } satisfies SwitchCompanyDataType,
              })

              if (res.redirect) router.push(res.destination)
              else router.replace(router.asPath)
            }}
          >
            Switch Company
          </Button>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="w-full cursor-pointer">
          <Button
            variant="ghost"
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
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// --- page ---

export default function AccountPage(serialisedProps: SerialisedProps) {
  const props = useMemo(() => deSerialiseDates(serialisedProps), [serialisedProps])
  const router = useRouter()
  const { connected, companyName, smallLogo, realmId, session } = props
  const subscription = props.subscribed ? props.subscription : undefined
  return (
    <section className="w-full p-4 pt-4 sm:p-10 sm:pt-14">
      <div className="mb-10">
        <h1 className="mb-4 text-xl">Account</h1>
        <hr className="border-accent border" />
        <div className="mb-2 flex flex-col-reverse py-4 sm:mb-0 sm:flex-row sm:justify-between">
          <table className="space-y-4 text-sm">
            <tr className="">
              <th className="py-4 pr-10 text-left font-normal sm:pr-24">Name</th>
              <td className="text-muted-foreground">{session.user.name}</td>
            </tr>
            <tr className="">
              <th className="py-4 pr-10 text-left font-normal sm:pr-24">Email</th>
              <td className="text-muted-foreground">{session.user.email}</td>
            </tr>
            <tr className="">
              <th className="py-4 pr-10 text-left font-normal sm:pr-24">Current Company Name</th>
              <td className="text-muted-foreground">{companyName}</td>
            </tr>
            {subscription && (
              <>
                <tr className="">
                  <th className="py-4 pr-10 text-left font-normal sm:pr-24">Subscribed since</th>
                  <td className="text-muted-foreground">
                    {formatDate(new Date(subscription.createdAt))}
                  </td>
                </tr>
                <tr className="">
                  <th className="py-4 pr-10 text-left font-normal sm:pr-24">
                    Subscription ends in
                  </th>
                  <td className="text-muted-foreground">
                    {getDaysBetweenDates(new Date(), new Date(subscription.currentPeriodEnd))} days
                  </td>
                </tr>
              </>
            )}
          </table>
          <div>
            {Boolean(smallLogo) && (
              <Image
                src={smallLogo as string}
                alt={`${companyName}'s logo`}
                height={50}
                width={50}
                className="mb-4 mr-10 rounded-md sm:mb-0"
              />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          {subscription && (
            <Button
              color={subscription.cancelAtPeriodEnd ? "blue" : "dark"}
              variant="outline"
              className="mb-1 flex"
              onClick={async e => {
                e.preventDefault()
                const data: DataType = { cancelAtPeriodEnd: !subscription.cancelAtPeriodEnd }
                await fetchJsonData("/api/stripe/update-subscription", {
                  method: "PUT",
                  body: data,
                })
                router.push(router.asPath)
              }}
            >
              {subscription.cancelAtPeriodEnd ? "Resubscribe" : "Unsubscribe"}
            </Button>
          )}
          {connected ? (
            <LoadingButton
              // this is the only colour which seems to work other than "blue" and I can't be bothered to fix it
              loadingImmediately
              variant="outline"
              color="dark"
              className="flex"
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
        </div>
      </div>
      {props.companies && props.companies.length > 0 && (
        <div>
          <h1 className="mb-4 text-xl">Companies</h1>
          <hr className="border-accent mb-2 border" />
          <Table>
            <TableCaption>All your connected and disconnected companies.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Id</TableHead>
                <TableHead>Connected</TableHead>
                <TableHead>Date Connected</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{props.companies.map(mapCompany)}</TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}

// --- server-side props ---

async function getAccountDetails(session: Session): Promise<[boolean, Companies]> {
  const accountList = (await db.query.accounts.findMany({
    columns: { companyName: true, id: true, createdAt: true, realmId: true, scope: true },
    where: and(isNotNull(accounts.companyName), eq(accounts.userId, session.user.id)),
    // get "accounting" accounts first
    orderBy: [asc(accounts.scope), desc(accounts.updatedAt)],
  })) as {
    companyName: string
    id: string
    createdAt: Date
    realmId: string
    scope: "accounting" | "profile"
  }[]

  if (
    accountList.length > 0 &&
    (!session.accountId || !accountList.some(a => a.id === session.accountId))
  ) {
    await db
      .update(sessions)
      .set({ accountId: accountList[0].id })
      .where(eq(sessions.userId, session.user.id))
    session.accountId = accountList[0].id
    return [true, accountList]
  }
  return [false, accountList.length > 0 ? accountList : null] as const
}

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
    getAccountDetails(session),
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
    props: serialiseDates({
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
    } satisfies Props),
  }
}
export const getServerSideProps = interceptGetServerSidePropsErrors(_getServerSideProps)
