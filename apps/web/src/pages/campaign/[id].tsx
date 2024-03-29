import { and, desc, eq, isNotNull } from "drizzle-orm"
import { GetServerSideProps } from "next"
import { getServerSession } from "next-auth"
import { ApiError } from "next/dist/server/api-utils"
import { useRouter } from "next/router"
import { useEffect, useRef, useState } from "react"

import { LayoutProps } from "@/components/layout"
import {
  AccountStatus,
  disconnectedRedirect,
  refreshTokenIfNeeded,
  refreshTokenRedirect,
  signInRedirect,
} from "@/lib/auth/next-auth-helper-server"
import { config } from "@/lib/env"
import { getAccountList, interceptGetServerSidePropsErrors } from "@/lib/util/get-server-side-props"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { EmailStatus, accounts, db, receipts, sessions } from "db"

type RecipientStatus = { email: string; donorId: string; emailStatus: EmailStatus }
type Props = {
  recipients: RecipientStatus[]
  refresh: boolean
  webhookUrl: string
} & LayoutProps

const getPillColor = (status: EmailStatus) => {
  switch (status) {
    case "sent":
      return "bg-gray-300 text-gray-900 dark:text-gray-200 dark:bg-zinc-800"
    case "not_sent":
      return "bg-red-300 text-gray-900 dark:text-gray-200 dark:bg-red-900"
    case "delivery_delayed":
      return "bg-stone-300 text-gray-900 dark:text-gray-200 dark:bg-stone-700"
    case "delivered":
      return "bg-green-300 text-gray-900 dark:text-gray-200 dark:bg-green-900"
    case "opened":
      return "bg-cyan-300 text-gray-900 dark:text-gray-200 dark:bg-cyan-900"
    case "clicked":
      return "bg-blue-300 text-gray-900 dark:text-gray-200 dark:bg-blue-900"
    case "bounced":
      return "bg-red-300 text-gray-900 dark:text-gray-200 dark:bg-red-900"
    case "complained":
    default:
      return "bg-orange-300 text-gray-900 dark:text-gray-200 dark:bg-orange-800"
  }
}

export default function Campaign({ recipients: initialRecipients, refresh, webhookUrl }: Props) {
  const router = useRouter()
  const [recipients, setRecipients] = useState(initialRecipients)
  const webhookRef = useRef<WebSocket>()

  useEffect(() => {
    if (!refresh) return
    const ws = new WebSocket(webhookUrl)
    ws.onmessage = event => {
      console.log("Received webhook event:", event.data)
      const { donorId, status } = JSON.parse(event.data) as {
        donorId: string
        status: EmailStatus
      }
      if (!donorId || donorId.length === 0 || !status || status.length === 0) {
        console.error("Invalid webhook data:", event.data)
        return
      }
      setRecipients(prev => {
        const index = prev.findIndex(r => r.donorId === donorId)
        if (index === -1) return prev
        const newRecipients = [...prev]
        newRecipients[index].emailStatus = status
        return newRecipients
      })
    }
    webhookRef.current = ws
    return () => ws.close()
  }, [refresh, webhookUrl])

  // if all the emails have been resolved (either sent, bounced, etc. doesn't matter), close the websocket
  useEffect(() => {
    if (refresh) return
    if (!webhookRef.current) return
    if (
      recipients.some(
        r =>
          r.emailStatus === "delivery_delayed" ||
          r.emailStatus === "sent" ||
          r.emailStatus === "not_sent",
      )
    )
      return
    console.log("Closing webhook")
    webhookRef.current.close()
  }, [recipients, refresh])

  return (
    <div className="sm:py-8">
      <table className="border-collapse overflow-hidden rounded-lg">
        <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            <th scope="col" className="cursor-pointer px-6 py-3">
              Donor Email
            </th>
            <th scope="col" className="cursor-pointer px-6 py-3">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {recipients.map((recipient, i) => (
            <tr
              key={i}
              className="relative border-b bg-white dark:border-gray-700 dark:bg-gray-800"
            >
              <th
                scope="row"
                className="whitespace-nowrap px-6 py-3 font-medium text-gray-900 dark:text-white"
              >
                {recipient.email}
              </th>
              <th
                scope="row"
                className={
                  "whitespace-nowrap px-6 py-3 font-mono font-medium " +
                  getPillColor(recipient.emailStatus)
                }
              >
                {recipient.emailStatus}
              </th>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const _getServerSideProps: GetServerSideProps<Props> = async ({ req, res, params }) => {
  if (!params) return { notFound: true }
  const id = params.id
  if (typeof id !== "string") return { notFound: true }

  const session = await getServerSession(req, res, authOptions)
  if (!session) return signInRedirect("items")

  const [account, recipients, [accountSwitched, accountList]] = await Promise.all([
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
    db.query.receipts.findMany({
      where: eq(receipts.campaignId, id),
      columns: { email: true, emailStatus: true, donorId: true },
      orderBy: desc(receipts.email),
    }),
    getAccountList(session),
  ])

  // this shouldn't really happen as the user should have been automatically signed into one of their connected accounts
  if (accountSwitched) {
    return { redirect: { destination: `campaign/${id}`, permanent: false } }
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
    return disconnectedRedirect(`campaign/${id}`)

  const { currentAccountStatus } = await refreshTokenIfNeeded(account)
  if (currentAccountStatus === AccountStatus.RefreshExpired) {
    return refreshTokenRedirect(`campaign/${id}`)
  }
  const webhookUrl = `${config.emailWebhookUrl}${config.emailWebhookUrl.at(-1) === "/" ? "" : "/"}${id}`

  return {
    props: {
      companies: accountList,
      session,
      selectedAccountId: session.accountId,
      recipients,
      refresh: recipients.some(
        r =>
          r.emailStatus === "delivery_delayed" ||
          r.emailStatus === "sent" ||
          r.emailStatus === "not_sent",
      ),
      webhookUrl,
    } satisfies Props,
  }
}
export const getServerSideProps = interceptGetServerSidePropsErrors(_getServerSideProps)
