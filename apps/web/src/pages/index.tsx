import { ArrowRightIcon, CheckIcon } from "@heroicons/react/24/solid"
import { accounts, sessions } from "db"
import { and, asc, desc, eq, isNotNull } from "drizzle-orm"
import { GetServerSideProps } from "next"
import { Session, getServerSession } from "next-auth"
import { ApiError } from "utils/dist/error"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ReactNode } from "react"

import { LayoutProps } from "@/components/layout"
import { getAccountList, interceptGetServerSidePropsErrors } from "@/lib/util/get-server-side-props"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import HandDrawnUpArrow from "@/public/svg/hand-drawn-up-arrow.svg"
import { db } from "db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "components/dist/ui/card"
import { Button } from "components/dist/ui/button"

const Tick = () => <CheckIcon className="text-primary absolute right-2 top-4 h-6 w-6" />
const Note = ({ children }: { children?: ReactNode }) => (
  <p className="text-primary text-sm font-bold">{children}</p>
)
const Arrow = () => <HandDrawnUpArrow className="mt-3 h-10 w-10 rotate-180 text-slate-400" />

type Props = {
  session: Session | null
  filledIn: { items: boolean; doneeDetails: boolean } | null
} & LayoutProps

export default function IndexPage({ filledIn, session }: Props) {
  const router = useRouter()
  return (
    <section className="mx-auto max-w-screen-xl space-y-12 p-4 px-4 text-center sm:py-8 lg:py-16">
      <div>
        <h1 className="mb-4 text-2xl font-extrabold leading-none tracking-tight text-gray-900 md:text-3xl lg:text-4xl dark:text-white">
          Speed up your organisation{"'"}s year-end
        </h1>
        <p className="mb-8 text-lg font-normal text-gray-500 sm:px-16 lg:px-48 lg:text-xl dark:text-gray-400">
          In just a few easy steps we can create and send your client{"'"}s donation receipts
        </p>
        {!filledIn ||
          (!filledIn.items && !filledIn.doneeDetails && (
            <Button asChild>
              <Link href="/items" className="px-5 py-3 text-lg">
                Get started
                <ArrowRightIcon className="ml-2 inline-block h-5 w-5" />
              </Link>
            </Button>
          ))}
      </div>
      <div className="flex w-full flex-col items-center">
        <Card
          onClickCapture={e => router.push(filledIn ? "/account" : "/api/auth/signin")}
          className="bg-card hover:bg-card-hover relative w-full max-w-sm cursor-pointer border-none transition-colors"
        >
          <CardHeader>
            <CardTitle>Link your account</CardTitle>
            <CardDescription>
              Sign in with your QuickBooks Online account and authorise our application
            </CardDescription>
          </CardHeader>
          {filledIn && session?.accountId !== undefined && <Tick />}
        </Card>
        <Arrow />
        <Card
          onClickCapture={e => router.push("/items")}
          className="bg-card hover:bg-card-hover relative mt-4 w-full max-w-sm cursor-pointer border-none transition-colors"
        >
          <CardHeader>
            <CardTitle>Select your qualifying items</CardTitle>
            <CardDescription>
              Select which of your QuickBooks sales items constitute a gift
            </CardDescription>
          </CardHeader>
          {filledIn && filledIn.items && <Tick />}
        </Card>
        <Arrow />
        <Card
          onClickCapture={e => router.push("/details")}
          className="bg-card hover:bg-card-hover relative mt-4 w-full max-w-sm cursor-pointer border-none transition-colors"
        >
          <CardHeader>
            <CardTitle>Enter your organisation{"'"}s details</CardTitle>
            <CardDescription>
              Enter necessary information such as registration number, signature, company logo, etc.
            </CardDescription>
          </CardHeader>
          {filledIn && filledIn.doneeDetails && <Tick />}
        </Card>
        <Arrow />
        <Card
          onClickCapture={e => router.push("/generate-receipts")}
          className="bg-card hover:bg-card-hover relative mt-4 w-full max-w-sm cursor-pointer border-none transition-colors"
        >
          <CardHeader>
            <CardTitle>Generate your clients{"'"} receipts</CardTitle>
            <CardDescription>Create receipts for all qualifying donations</CardDescription>
          </CardHeader>
          {filledIn && filledIn.doneeDetails && filledIn.items && (
            <CardContent>
              Receipts can be downloaded individually or all together
              <Tick />
              <Note>We{"'"}re ready to create your receipts!</Note>
            </CardContent>
          )}
        </Card>
        <Arrow />
        <Card
          onClickCapture={e => router.push("/email")}
          className="bg-card hover:bg-card-hover relative mt-4 w-full max-w-sm cursor-pointer border-none transition-colors"
        >
          <CardHeader>
            <CardTitle>Send your donors their receipts</CardTitle>
            <CardDescription>Automatically email receipts to all qualifying donors</CardDescription>
          </CardHeader>
          {filledIn && filledIn.doneeDetails && filledIn.items && (
            <CardContent>
              <Tick />
              <Note>We{"'"}re ready to send your receipts!</Note>
            </CardContent>
          )}
        </Card>
      </div>
    </section>
  )
}

// --- server-side props ---

const _getServerSideProps: GetServerSideProps<Props> = async ({ req, res }) => {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return {
      props: {
        session: null,
        filledIn: null,
      } satisfies Props,
    }
  }

  // the account retrieved will either be the account specified in the session
  // or the first account for the user that has a realmId
  let [account, [accountSwitched, accountList]] = await Promise.all([
    db.query.accounts.findFirst({
      // if the realmId is specified get that account otherwise just get the first account for the user
      where: and(
        eq(accounts.userId, session.user.id),
        session.accountId ? eq(accounts.id, session.accountId) : isNotNull(accounts.realmId),
      ),
      columns: { scope: true, id: true },
      with: { userData: { columns: { id: true } }, doneeInfo: { columns: { id: true } } },
      orderBy: [asc(accounts.scope), desc(accounts.updatedAt)],
    }),
    getAccountList(session),
  ])

  // this shouldn't really happen as the user should have been automatically signed into one of their connected accounts
  if (accountSwitched) {
    return { redirect: { destination: "/", permanent: false } }
  }

  if (!session.accountId || !account) return { props: { session, filledIn: null } satisfies Props }

  // const user = await getUserDataOrThrow(session.user.id)
  const filledIn = { items: Boolean(account.userData), doneeDetails: Boolean(account.doneeInfo) }

  return {
    props: {
      session,
      filledIn,
      companies: accountList,
      selectedAccountId: session.accountId,
    } satisfies Props,
  }
}
export const getServerSideProps = interceptGetServerSidePropsErrors(_getServerSideProps)
