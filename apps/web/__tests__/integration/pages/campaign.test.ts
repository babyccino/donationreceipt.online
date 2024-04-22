import { describe, expect, test } from "bun:test"
import { Session } from "next-auth"

import { LayoutProps } from "@/components/layout"
import { disconnectedRedirect } from "@/lib/auth/next-auth-helper-server"
import { serialiseDates } from "@/lib/util/nextjs-helper"
import { db, doneeInfos } from "db"
import { createEmailCampaign, createUser, getMockApiContext, mockDoneeInfo } from "../mocks"

import { Props, getServerSideProps } from "@/pages/campaign"

describe("items page getServerSideProps", () => {
  test("getServerSideProps returns sign in redirect when user is not signed in", async () => {
    const ctx = getMockApiContext("GET", "", {})
    const props = await getServerSideProps(ctx as any)
    expect(props).toEqual({
      redirect: {
        permanent: false,
        destination: "/auth/signin?callback=campaign",
      },
    })
  })

  test("getServerSideProps returns disconnected redirect when user is not conneted", async () => {
    const { session, deleteUser } = await createUser(false)
    const ctx = getMockApiContext("GET", session.sessionToken, {})
    const props = await getServerSideProps(ctx as any)
    expect(props).toEqual(disconnectedRedirect("campaign"))
    await deleteUser()
  })

  test("getServerSideProps returns expected props when user is connected", async () => {
    const { user, account, session } = await createUser(true)
    const receiptCount = 15
    const { campaign, receipts } = await createEmailCampaign(account.id, receiptCount)
    const ctx = getMockApiContext("GET", session.sessionToken, {})
    const props = await getServerSideProps(ctx as any)
    const inCompleteReceipts = receipts.reduce<number>(
      (total, curr) =>
        total + (["sent", "delivery_delayed", "not_sent"].includes(curr.emailStatus) ? 1 : 0),
      0,
    )
    const expectedProps = {
      session: {
        accountId: account.id,
        expires: session.expires.toISOString(),
        user: {
          country: user.country,
          email: user.email,
          id: user.id,
          name: user.name as string,
        },
      } satisfies Session,
      companies: [
        { companyName: account.companyName as string, id: account.id },
      ] satisfies LayoutProps["companies"],
      selectedAccountId: session.accountId,
      campaigns: [
        {
          id: campaign.id,
          name: campaign.name,
          createdAt: campaign.createdAt,
          receiptCount,
          inCompleteReceiptCount: inCompleteReceipts,
        },
      ],
    } satisfies Props
    expect(props).toEqual({ props: serialiseDates(expectedProps) as any })

    const receiptCount2 = 20
    const { campaign: campaign2, receipts: receipts2 } = await createEmailCampaign(
      account.id,
      receiptCount2,
    )
    const props2 = await getServerSideProps(ctx as any)
    const inCompleteReceipts2 = receipts2.reduce<number>(
      (total, curr) =>
        total + (["sent", "delivery_delayed", "not_sent"].includes(curr.emailStatus) ? 1 : 0),
      0,
    )
    const doneeInfo = mockDoneeInfo(account.id)
    await db.insert(doneeInfos).values(doneeInfo)

    const expectedProps2 = serialiseDates({
      ...expectedProps,
      campaigns: [
        {
          id: campaign2.id,
          name: campaign2.name,
          createdAt: campaign2.createdAt,
          receiptCount: receiptCount2,
          inCompleteReceiptCount: inCompleteReceipts2,
        },
        expectedProps.campaigns[0],
      ],
    })
    expectedProps2.campaigns.sort((a, b) => (a.id > b.id ? -1 : 1))
    ;(props2 as any).props.campaigns.sort((a: any, b: any) => (a.id > b.id ? -1 : 1))
    expect(props2).toEqual({ props: expectedProps2 as any })
  })
})
