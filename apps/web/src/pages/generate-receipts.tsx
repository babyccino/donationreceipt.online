import { ArrowRightIcon } from "@heroicons/react/24/solid"
import download from "downloadjs"
import { and, desc, eq, isNotNull, sql } from "drizzle-orm"
import { Alert, Card } from "flowbite-react"
import { GetServerSideProps } from "next"
import { Session, getServerSession } from "next-auth"
import { ApiError } from "next/dist/server/api-utils"
import dynamic from "next/dynamic"
import React, { ReactNode, useState } from "react"
import { twMerge } from "tailwind-merge"

import { LayoutProps } from "@/components/layout"
import { LoadingButton, MissingData } from "@/components/ui"
import {
  AccountStatus,
  disconnectedRedirect,
  refreshTokenIfNeeded,
  refreshTokenRedirect,
  signInRedirect,
} from "@/lib/auth/next-auth-helper-server"
import { getDonations } from "@/lib/qbo-api"
import { isUserSubscribed } from "@/lib/stripe"
import { getAccountList, interceptGetServerSidePropsErrors } from "@/lib/util/get-server-side-props"
import { subscribe } from "@/lib/util/request"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { Link } from "components/dist/link"
import {
  DownloadReceiptLoading,
  DummyDownloadReceipt,
  DummyShowReceipt,
  ShowReceiptLoading,
} from "components/dist/receipt/pdf-dumb"
import { EmailProps } from "components/dist/receipt/types"
import { DoneeInfo, accounts, campaigns, db, sessions } from "db"
import { storageBucket } from "db/dist/firebase"
import { Donation } from "types"
import { getDonationRange, getThisYear } from "utils/dist/date"
import { downloadImageAndConvertToPng } from "utils/dist/db-helper"
import { getRandomBalance, getRandomName } from "utils/dist/etc"
import { getResponseContent } from "utils/dist/request"

const DownloadReceipt = dynamic(
  () => import("components/dist/receipt/pdf").then(imp => imp.DownloadReceipt),
  {
    loading: DownloadReceiptLoading,
    ssr: false,
  },
)
const ShowReceipt = dynamic(() => import("../components/pdf").then(imp => imp.ShowReceipt), {
  loading: ShowReceiptLoading,
  ssr: false,
})

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
    <div className="mb-4 flex flex-row items-baseline gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
      <p className="inline font-normal text-gray-700 dark:text-gray-400">Download all receipts</p>
      <LoadingButton loading={loading} onClick={onClick} disabled={loading} color="blue">
        Download
      </LoadingButton>
    </div>
  )
}

const ReceiptLimitCard = () => (
  <Card className="absolute max-w-sm sm:left-1/2 sm:top-6 sm:-translate-x-1/2">
    <h5 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
      You{"'"}ve hit your free receipt limit
    </h5>
    <p className="font-normal text-gray-700 dark:text-gray-400">
      To save and send all of your organisation{"'"}s receipts click the link below to go pro
    </p>
    <div className="">
      <LoadingButton
        loadingImmediately
        color="blue"
        onClick={() => subscribe("/generate-receipts")}
      >
        Click here to go pro!
      </LoadingButton>
    </div>
  </Card>
)

const Tr = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <tr
    className={twMerge(
      className,
      "relative border-b bg-white dark:border-gray-700 dark:bg-gray-800",
    )}
  >
    {children}
  </tr>
)
const Th = ({ children }: { children?: ReactNode }) => (
  <th scope="row" className="whitespace-nowrap px-6 py-2 font-medium text-gray-900 dark:text-white">
    {children}
  </th>
)
const Td = ({ children }: { children?: ReactNode }) => <td className="px-6 py-2">{children}</td>

const blurredRows = new Array(10).fill(0).map((_, idx) => (
  <Tr key={idx}>
    <Th>{getRandomName()}</Th>
    <Td>{getRandomBalance()}</Td>
    <Td>
      <DummyShowReceipt />
    </Td>
    <Td>
      <DummyDownloadReceipt />
    </Td>
    <div
      className={twMerge(
        !idx && "z-10",
        "absolute left-0 top-[2px] h-full w-full backdrop-blur-sm",
      )}
    >
      {!idx && <ReceiptLimitCard />}
    </div>
  </Tr>
))

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

enum Sort {
  Default = 0,
  NameAsc,
  NameDesc,
  TotalAsc,
  TotalDesc,
}

function getSortedDonations(donations: Donation[], sort: Sort) {
  switch (sort) {
    case Sort.NameAsc:
      return donations.sort((a, b) => a.name.localeCompare(b.name))
    case Sort.NameDesc:
      return donations.sort((a, b) => b.name.localeCompare(a.name))
    case Sort.TotalAsc:
      return donations.sort((a, b) => a.total - b.total)
    case Sort.TotalDesc:
      return donations.sort((a, b) => b.total - a.total)
    case Sort.Default:
    default:
      return donations
  }
}

const unsortedSymbol = (
  <span className="relative">
    <span className="absolute translate-y-[0.21rem]">▾</span>
    <span className="absolute translate-y-[-0.21rem]">▴</span>
    <span className="opacity-0">▾</span>
  </span>
)
function getNameSort(sort: Sort): ReactNode {
  if (sort === Sort.NameAsc) return "▾"
  if (sort === Sort.NameDesc) return "▴"
  return unsortedSymbol
}
function getTotalSort(sort: Sort): ReactNode {
  if (sort === Sort.TotalAsc) return "▴"
  if (sort === Sort.TotalDesc) return "▾"
  return unsortedSymbol
}

const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "CAD" })

// ----- PAGE ----- //

export default function IndexPage(props: Props) {
  const [sort, setSort] = useState<Sort>(Sort.Default)

  if (!props.receiptsReady) return <MissingData filledIn={props.filledIn} />

  const { doneeInfo, subscribed, counterStart } = props
  const donations = getSortedDonations(props.donations, sort)

  const currentYear = getThisYear()
  const mapCustomerToTableRow = (entry: Donation, index: number): JSX.Element => {
    const fileName = `${entry.name}.pdf`
    const receiptProps: EmailProps = {
      currency: "CAD",
      currentDate: new Date(),
      donation: entry,
      donationDate: props.donationRange,
      donee: doneeInfo,
      receiptNo: currentYear * 100000 + index + counterStart,
    }

    return (
      <Tr key={entry.donorId}>
        <Th>{entry.name}</Th>
        <Td>{formatter.format(entry.total)}</Td>
        <Td>
          <ShowReceipt receiptProps={receiptProps} />
        </Td>
        <Td>
          <DownloadReceipt receiptProps={receiptProps} fileName={fileName} />
        </Td>
      </Tr>
    )
  }

  return (
    <section className="flex h-full w-full flex-col p-8">
      {subscribed && (
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <DownloadAllFiles />
          <div className="mb-4 flex flex-row items-baseline gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
            <p className="inline font-normal text-gray-700 dark:text-gray-400">Email your donors</p>
            <Link href="/email">Email</Link>
          </div>
        </div>
      )}
      <Alert
        color="info"
        className="mb-4 sm:hidden"
        icon={() => <ArrowRightIcon className="mr-2 h-6 w-6" />}
      >
        Scroll right to view/download individual receipts
      </Alert>
      <div className="w-full overflow-x-auto overflow-y-hidden sm:rounded-lg">
        <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
          <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th
                scope="col"
                className="cursor-pointer px-6 py-3"
                onClick={() => setSort(sort === Sort.NameAsc ? Sort.NameDesc : Sort.NameAsc)}
              >
                Donor Name {getNameSort(sort)}
              </th>
              <th
                scope="col"
                className="cursor-pointer px-6 py-3"
                onClick={() => setSort(sort === Sort.TotalDesc ? Sort.TotalAsc : Sort.TotalDesc)}
              >
                Total {getTotalSort(sort)}
              </th>
              <th scope="col" className="px-6 py-3">
                Show Receipt
              </th>
              <th scope="col" className="px-6 py-3">
                Download Receipt
              </th>
            </tr>
          </thead>
          <tbody>
            {donations.map(mapCustomerToTableRow)}
            {!subscribed && blurredRows}
          </tbody>
        </table>
      </div>
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
