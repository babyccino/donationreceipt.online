import { ArrowsUpDownIcon } from "@heroicons/react/24/solid"
import { DotsHorizontalIcon } from "@radix-ui/react-icons"
import { createColumnHelper } from "@tanstack/react-table"
import { and, desc, eq, sql } from "drizzle-orm"
import { GetServerSideProps } from "next"
import { getServerSession } from "next-auth"
import Link from "next/link"

import { LayoutProps } from "@/components/layout"
import { DataTable } from "@/components/table"
import {
  AccountStatus,
  disconnectedRedirect,
  refreshTokenIfNeeded,
  refreshTokenRedirect,
  signInRedirect,
} from "@/lib/auth/next-auth-helper-server"
import { getAccountList, interceptGetServerSidePropsErrors } from "@/lib/util/get-server-side-props"
import { SerialiseDates, deSerialiseDates, serialiseDates } from "@/lib/util/nextjs-helper"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { Button } from "components/dist/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "components/dist/ui/dropdown-menu"
import { accounts, campaigns as campaignsSchema, db, receipts, sessions } from "db"
import { formatDateHtml } from "utils/dist/date"
import { ApiError } from "utils/dist/error"

type Campaign = {
  id: string
  name: string
  createdAt: Date
  receiptCount: number
  inCompleteReceiptCount: number
}
export type Props = {
  campaigns: Campaign[]
} & LayoutProps
type SerialisedProps = SerialiseDates<Props>

const columnHelper = createColumnHelper<Campaign>()
const columns = [
  columnHelper.accessor("name", {
    header({ column }) {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowsUpDownIcon className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell({ row, cell }) {
      const id = row.original.id
      const name = cell.getValue()
      return (
        <Button asChild variant="ghost" className="block h-full w-full text-left">
          <Link href={`campaign/${id}`}>{name}</Link>
        </Button>
      )
    },
  }),
  columnHelper.accessor("createdAt", {
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Send Date
          <ArrowsUpDownIcon className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell({ cell }) {
      const date = cell.getValue()
      return <div className="w-full text-center">{formatDateHtml(date)}</div>
    },
  }),
  columnHelper.accessor("receiptCount", {
    header: ({ column }) => {
      return (
        <Button
          className="flex w-full pb-2 text-center"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Receipts
          <br />
          Sent
          <ArrowsUpDownIcon className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell({ cell }) {
      const count = cell.getValue()
      return <div className="w-full pr-4 text-right">{count.toString()}</div>
    },
  }),
  columnHelper.accessor("inCompleteReceiptCount", {
    header: ({ column }) => {
      return (
        <Button
          className="flex w-full pb-2 text-center"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
          <ArrowsUpDownIcon className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell({ cell }) {
      const count = cell.getValue()
      const inProgress =
        "bg-blue-200 text-blue-800 dark:text-blue-200 animate-pulse dark:bg-blue-900"
      const complete = "bg-green-200 text-green-800 dark:text-green-200 dark:bg-green-900"
      const className =
        "inline-block rounded-full px-3 py-1 text-center text-sm leading-none " +
        (count > 0 ? inProgress : complete)
      return (
        <div className="w-full text-center">
          <span className={className}>{count > 0 ? "In progress..." : "Complete"}</span>
        </div>
      )
    },
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    enableHiding: false,
    cell({ row }) {
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
            <DropdownMenuItem asChild className="p-0">
              <Button asChild variant="ghost">
                <a className="cursor-pointer" href={`mailto:${row.getValue("email")}`}>
                  Email Donor
                </a>
              </Button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  }),
]

export default function CampaignList(props: SerialisedProps) {
  const { campaigns } = deSerialiseDates(props)
  return (
    <div className="relative flex w-full max-w-2xl flex-col items-center space-y-4 p-4 sm:py-8">
      {campaigns.length > 0 ? (
        <>
          <div className="text-left">
            <h1 className="mb-4 text-2xl">Your Campaigns</h1>
            <p className="text-muted-foreground mb-4 text-sm">
              Here are your previous campaigns. You can view the receipts sent for each campaign by
              clicking on the campaign id.
            </p>
          </div>
          <div className="w-full overflow-x-auto">
            <DataTable columns={columns} data={campaigns} />
          </div>
        </>
      ) : (
        <div className="mt-6 w-full max-w-lg text-left sm:mt-36">
          <h1 className="mb-4 text-2xl">No campaigns</h1>
          <p className="text-muted-foreground mb-1 text-sm">
            You don{"'"}t have any previous campaigns.
          </p>
          <p className="text-muted-foreground mb-4 text-sm">
            You can create a new campaign and start sending emails to your subscribers.
          </p>
          <Button asChild variant="primary">
            <Link href="email">Create your first campaign!</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

const _getServerSideProps: GetServerSideProps<SerialisedProps> = async ({ req, res }) => {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return signInRedirect("campaign")

  const [account, campaigns, [accountSwitched, accountList]] = await Promise.all([
    db.query.accounts.findFirst({
      // if the realmId is specified get that account otherwise just get the first account for the user
      where: and(
        eq(accounts.userId, session.user.id),
        session.accountId ? eq(accounts.id, session.accountId) : eq(accounts.scope, "accounting"),
      ),
      columns: {
        id: true,
        accessToken: true,
        scope: true,
        realmId: true,
        createdAt: true,
        expiresAt: true,
        refreshToken: true,
        refreshTokenExpiresAt: true,
      },
      orderBy: desc(accounts.updatedAt),
    }),
    db
      .select({
        id: campaignsSchema.id,
        createdAt: campaignsSchema.createdAt,
        name: campaignsSchema.name,
        receiptCount: sql<number>`COUNT(*)`,
        inCompleteReceiptCount: sql<number>`
          SUM(
            CASE WHEN receipts.email_status IN ('not_sent',  'sent',  'delivery_delayed')
            THEN 1
            ELSE 0
          END)
        `,
      })
      .from(campaignsSchema)
      .where(eq(campaignsSchema.accountId, session.accountId ?? ""))
      .innerJoin(receipts, eq(campaignsSchema.id, receipts.campaignId))
      .orderBy(desc(campaignsSchema.createdAt))
      .groupBy(campaignsSchema.id),
    getAccountList(session),
  ])

  // this shouldn't really happen as the user should have been automatically signed into one of their connected accounts
  if (accountSwitched) {
    return { redirect: { destination: "campaign", permanent: false } }
  }

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

  if (
    !account ||
    account.scope !== "accounting" ||
    !account.accessToken ||
    !account.realmId ||
    !session.accountId
  )
    return disconnectedRedirect("campaign")

  const { currentAccountStatus } = await refreshTokenIfNeeded(account)
  if (currentAccountStatus === AccountStatus.RefreshExpired) {
    return refreshTokenRedirect("campaign")
  }
  return {
    props: serialiseDates({
      campaigns,
      session,
      companies: accountList,
      selectedAccountId: session.accountId,
    } satisfies Props),
  }
}
export const getServerSideProps =
  interceptGetServerSidePropsErrors<GetServerSideProps<SerialisedProps>>(_getServerSideProps)
