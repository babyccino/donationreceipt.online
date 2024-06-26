import { ArrowRightIcon, ArrowsUpDownIcon } from "@heroicons/react/24/solid"
import { DotsHorizontalIcon } from "@radix-ui/react-icons"
import {
  ColumnDef,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import download from "downloadjs"
import { and, eq, sql } from "drizzle-orm"
import { atom, useAtom, useSetAtom } from "jotai"
import { GetServerSideProps } from "next"
import { Session, getServerSession } from "next-auth"
import dynamic from "next/dynamic"
import { useState } from "react"
import { twMerge } from "tailwind-merge"
import Link from "next/link"

import { LayoutProps } from "@/components/layout"
import { DataTable } from "@/components/table"
import { LoadingButton, MissingData } from "@/components/ui"
import {
  AccountStatus,
  disconnectedRedirect,
  refreshTokenIfNeeded,
  refreshTokenRedirect,
  signInRedirect,
} from "@/lib/auth/next-auth-helper-server"
import { SupportedCurrencies } from "@/lib/intl"
import { getDonations } from "@/lib/qbo-api"
import { isUserSubscribed } from "@/lib/stripe"
import { getAccountList, interceptGetServerSidePropsErrors } from "@/lib/util/get-server-side-props"
import { subscribe } from "@/lib/util/request"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { EmailProps } from "components/dist/receipt/types"
import { Alert, AlertDescription } from "components/dist/ui/alert"
import { Button } from "components/dist/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "components/dist/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "components/dist/ui/dropdown-menu"
import { Spinner } from "components/dist/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "components/dist/ui/table"
import { DoneeInfo, accounts, campaigns, db } from "db"
import { storageBucket } from "db/dist/firebase"
import { Donation } from "types"
import { getDonationRange, getThisYear } from "utils/dist/date"
import { downloadImageAndConvertToPng } from "utils/dist/db-helper"
import { ApiError } from "utils/dist/error"
import { getRandomBalance, getRandomName } from "utils/dist/etc"
import { getResponseContent } from "utils/dist/request"

const DownloadReceipt = dynamic(
  () => import("components/dist/receipt/pdf").then(imp => imp.DownloadReceipt),
  {
    loading: () => <Spinner />,
    ssr: false,
  },
)
const ReceiptDisplay = dynamic(() => import("../components/pdf").then(imp => imp.ReceiptDisplay), {
  loading: () => null,
  ssr: false,
})

type Props = (
  | {
      receiptsReady: true
      session: Session
      donations: Donation[]
      doneeInfo: Omit<DoneeInfo, "accountId" | "createdAt" | "id" | "updatedAt">
      subscribed: boolean
      counterStart: number
      donationRange: string
    }
  | {
      receiptsReady: false
      filledIn: { items: boolean; doneeDetails: boolean }
    }
) &
  LayoutProps

const receiptAtom = atom<EmailProps | null>(null)

const columnHelper = createColumnHelper<Donation & { email: string }>()
const makeColumns = (
  doneeInfo: Omit<DoneeInfo, "accountId" | "createdAt" | "id" | "updatedAt">,
  currency: SupportedCurrencies,
  donationDate: string,
  sortingEnabled: boolean = true,
) => {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency })
  return [
    columnHelper.accessor("name", {
      header({ column }) {
        return (
          <Button
            variant="ghost"
            onClick={
              sortingEnabled
                ? () => column.toggleSorting(column.getIsSorted() === "asc")
                : undefined
            }
          >
            Name
            {sortingEnabled && <ArrowsUpDownIcon className="ml-2 h-4 w-4" />}
          </Button>
        )
      },
    }),
    columnHelper.accessor("email", {
      header({ column }) {
        return (
          <Button
            variant="ghost"
            onClick={
              sortingEnabled
                ? () => column.toggleSorting(column.getIsSorted() === "asc")
                : undefined
            }
          >
            Email
            {sortingEnabled && <ArrowsUpDownIcon className="ml-2 h-4 w-4" />}
          </Button>
        )
      },
    }),
    columnHelper.accessor("total", {
      header: ({ column }) => {
        return (
          <Button
            className="w-full justify-end"
            variant="ghost"
            onClick={
              sortingEnabled
                ? () => column.toggleSorting(column.getIsSorted() === "asc")
                : undefined
            }
          >
            Total
            {sortingEnabled && <ArrowsUpDownIcon className="ml-2 h-4 w-4" />}
          </Button>
        )
      },
      cell({ row }) {
        const amount = parseFloat(row.getValue("total"))
        const formatted = formatter.format(amount)

        return <div className="text-right font-medium">{formatted}</div>
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      enableHiding: false,
      cell({ row }) {
        const entry = row.original
        const fileName = `${entry.name}.pdf`
        const receiptProps: EmailProps = {
          currency,
          currentDate: new Date(),
          donation: entry,
          donationDate,
          donee: doneeInfo,
          receiptNo: 1,
        }

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
              <DropdownMenuItem className="p-0">
                <ShowReceipt receiptProps={receiptProps} />
              </DropdownMenuItem>
              <DropdownMenuItem className="p-0">
                <DownloadReceipt receiptProps={receiptProps} fileName={fileName} />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    }),
  ]
}

const ShowReceipt = ({ receiptProps }: { receiptProps: EmailProps }) => {
  const setReceipt = useSetAtom(receiptAtom)

  return (
    <Button
      variant="ghost"
      onClick={() => {
        setReceipt(receiptProps)
      }}
    >
      Show receipt
    </Button>
  )
}

const ReceiptLimitCard = () => (
  <Card className="absolute max-w-sm sm:left-1/2 sm:top-6 sm:-translate-x-1/2">
    <CardHeader>
      <CardTitle>You{"'"}ve hit your free receipt limit</CardTitle>
      <CardDescription>
        To save and send all of your organisation{"'"}s receipts click the link below to go pro
      </CardDescription>
    </CardHeader>
    <CardFooter>
      <LoadingButton loadingImmediately onClick={() => subscribe("/generate-receipts")}>
        Click here to go pro!
      </LoadingButton>
    </CardFooter>
  </Card>
)

const blurredRows = new Array(10).fill(0).map((_, idx) => (
  <TableRow className="relative" key={idx}>
    <TableCell>{getRandomName()}</TableCell>
    <TableCell>{getRandomName()}@gmail.com</TableCell>
    <TableCell className="text-right">CA${getRandomBalance()}</TableCell>
    <TableCell>
      <Button variant="ghost" className="h-8 w-8 p-0">
        <span className="sr-only">Open menu</span>
        <DotsHorizontalIcon className="h-4 w-4" />
      </Button>
      <div
        className={twMerge(
          !idx && "z-10",
          "absolute left-0 top-[2px] h-full w-full backdrop-blur-sm",
        )}
      >
        {!idx && <ReceiptLimitCard />}
      </div>
    </TableCell>
  </TableRow>
))

function UnSubbedDataTable({
  columns,
  data,
}: {
  columns: ColumnDef<Donation & { email: string }, any>[]
  data: (Donation & { email: string })[]
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="overflow-hidden rounded-md">
      <Table className="overflow-hidden">
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map(row => (
              <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
          {blurredRows}
        </TableBody>
      </Table>
    </div>
  )
}

function DownloadAllFiles() {
  const [loading, setLoading] = useState(false)

  const onClick = async () => {
    setLoading(true)
    const response = await fetch("/api/receipt")
    setLoading(false)
    if (!response.ok) {
      const content = await getResponseContent(response)
      const text = typeof content === "string" ? content : JSON.stringify(content)
      throw new ApiError(response.status, text)
    }
    setLoading(false)
    download(await response.blob())
  }

  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium">Download all receipts</h3>
      <p className="text-muted-foreground mb-2 text-sm tracking-wide">
        Download all receipts for this month in a single zip file
      </p>
      <LoadingButton loading={loading} onClick={onClick} disabled={loading}>
        Download
      </LoadingButton>
    </div>
  )
}

// ----- PAGE ----- //

export default function IndexPage(props: Props) {
  if (!props.receiptsReady) return <MissingData filledIn={props.filledIn} />
  return <WithTable {...props} />
}

function ReceiptDialog() {
  const [receipt, setReceipt] = useAtom(receiptAtom)

  if (!receipt) return null
  return <ReceiptDisplay receiptProps={receipt} close={() => setReceipt(null)} />
}

function WithTable(props: {
  receiptsReady: true
  session: Session
  donations: Donation[]
  doneeInfo: Omit<DoneeInfo, "accountId" | "createdAt" | "id" | "updatedAt">
  subscribed: boolean
  counterStart: number
  donationRange: string
}) {
  const { doneeInfo, subscribed, counterStart } = props
  const donations = props.donations.map(donation => ({ ...donation, email: donation.email ?? "" }))
  const currentYear = getThisYear()
  const columns = makeColumns(doneeInfo, "cad", new Date().toISOString(), subscribed)

  return (
    <section className="flex h-full w-full max-w-4xl flex-col items-center p-4">
      <ReceiptDialog />
      <Alert className="mb-4 sm:hidden">
        <ArrowRightIcon className="mr-2 h-4 w-4" />
        <AlertDescription>Scroll right to view/download individual receipts</AlertDescription>
      </Alert>
      <div className="w-full overflow-x-auto sm:rounded-lg">
        {subscribed ? (
          <DataTable
            columns={columns}
            data={donations}
            filters={[{ id: "email", placeholder: "Filter by email..." }]}
          />
        ) : (
          <UnSubbedDataTable columns={columns} data={donations} />
        )}
      </div>
      {subscribed && (
        <div className="flex w-full flex-col items-start justify-center gap-4">
          <DownloadAllFiles />
          <div className="mb-4">
            <h3 className="text-sm font-medium">Email your donors</h3>
            <p className="text-muted-foreground mb-2 text-sm tracking-wide">
              You{"'"}re all set! You can email your receipts out to your donors.
            </p>
            <Button asChild variant="primary">
              <Link href="/email">Email</Link>
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

// --- server-side props ---

const _getServerSideProps: GetServerSideProps<Props> = async ({ req, res }) => {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return signInRedirect("generate-receipts")

  let [account, [accountSwitched, accountList]] = await Promise.all([
    session.accountId
      ? db.query.accounts.findFirst({
          // if the realmId is specified get that account otherwise just get the first account for the user
          where: and(eq(accounts.userId, session.user.id), eq(accounts.id, session.accountId)),
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
          with: {
            doneeInfo: {
              columns: { createdAt: false, updatedAt: false, id: false, accountId: false },
            },
            userData: { columns: { items: true, startDate: true, endDate: true } },
            user: {
              columns: {},
              with: { subscription: { columns: { status: true, currentPeriodEnd: true } } },
            },
          },
        })
      : null,
    getAccountList(session),
  ])

  // this shouldn't really happen as the user should have been automatically signed into one of their connected accounts
  if (accountSwitched) {
    return { redirect: { destination: "/generate-receipts", permanent: false } }
  }

  if (session.accountId && !account)
    throw new ApiError(500, "account for given user and session not found in db")

  if (
    !account ||
    account.scope !== "accounting" ||
    !account.accessToken ||
    !account.realmId ||
    !session.accountId
  )
    return disconnectedRedirect("generate-receipts")
  const { doneeInfo, userData, realmId } = account

  if (!doneeInfo || !userData)
    return {
      props: {
        receiptsReady: false,
        filledIn: { doneeDetails: Boolean(doneeInfo), items: Boolean(userData) },
        session,
        companies: accountList,
        selectedAccountId: account.id,
      } satisfies Props,
    }

  const { currentAccountStatus } = await refreshTokenIfNeeded(account)
  if (currentAccountStatus === AccountStatus.RefreshExpired) {
    return refreshTokenRedirect("generate-receipts")
  }

  const { startDate, endDate, items } = userData
  const [donations, pngSignature, pngLogo, counterQuery] = await Promise.all([
    getDonations(
      account.accessToken,
      realmId,
      { startDate: startDate, endDate: endDate },
      items ? items.split(",") : [],
    ),
    downloadImageAndConvertToPng(storageBucket, doneeInfo.signature),
    downloadImageAndConvertToPng(storageBucket, doneeInfo.smallLogo),
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(campaigns)
      .where(and(eq(campaigns.accountId, session.user.id))),
  ])
  doneeInfo.signature = pngSignature
  doneeInfo.smallLogo = pngLogo
  const subscription = account.user.subscription
  const subscribed = subscription ? isUserSubscribed(subscription) : false

  if (counterQuery.length !== 1) throw new ApiError(500, "counter query returned more than one row")
  const counterStart = counterQuery[0].count + 1

  return {
    props: {
      receiptsReady: true,
      session,
      donations: subscribed ? donations : donations.slice(0, 3),
      doneeInfo,
      subscribed,
      companies: accountList,
      selectedAccountId: account.id,
      counterStart,
      donationRange: getDonationRange(startDate, endDate),
    } satisfies Props,
  }
}
export const getServerSideProps = interceptGetServerSidePropsErrors(_getServerSideProps)
