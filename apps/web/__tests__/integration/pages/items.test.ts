import { createId } from "@paralleldrive/cuid2"
import { describe, expect, test } from "bun:test"
import { Session } from "next-auth"

import { LayoutProps } from "@/components/layout"
import { disconnectedRedirect } from "@/lib/auth/next-auth-helper-server"
import { serialiseDates } from "@/lib/util/nextjs-helper"
import { db, doneeInfos, userDatas } from "db"
import { createUser, getMockApiContext, mockDoneeInfo, mockResponses } from "../mocks"

import { getServerSideProps } from "@/pages/items"

describe("items page getServerSideProps", () => {
  test("getServerSideProps returns sign in redirect when user is not signed in", async () => {
    const ctx = getMockApiContext("GET", "", {})
    const props = await getServerSideProps(ctx as any)
    expect(props).toEqual({
      redirect: {
        permanent: false,
        destination: "/auth/signin?callback=items",
      },
    })
  })

  test("getServerSideProps returns disconnected redirect when user is not conneted", async () => {
    const { session, deleteUser } = await createUser(false)
    const ctx = getMockApiContext("GET", session.sessionToken, {})
    const props = await getServerSideProps(ctx as any)
    expect(props).toEqual(disconnectedRedirect("items"))
    await deleteUser()
  })

  test("getServerSideProps returns expected items when user is connected", async () => {
    const { user, account, session, deleteUser } = await createUser(true)

    const ctx = getMockApiContext("GET", session.sessionToken, {})
    const props = await getServerSideProps(ctx as any)
    const expectedProps = {
      itemsFilledIn: false,
      session: {
        accountId: account.id,
        expires: session.expires.toISOString(),
        user: {
          email: user.email,
          id: user.id,
          name: user.name as string,
        },
      } satisfies Session,
      items: mockResponses.items,
      detailsFilledIn: false,
      companies: [
        { companyName: account.companyName as string, id: account.id },
      ] satisfies LayoutProps["companies"],
      selectedAccountId: session.accountId,
    } as const
    expect(props).toEqual({ props: expectedProps })

    const doneeInfo = mockDoneeInfo(account.id)
    await db.insert(doneeInfos).values(doneeInfo)

    const props2 = await getServerSideProps(ctx as any)
    expect(props2).toEqual({ props: { ...expectedProps, detailsFilledIn: true } })
  })

  test("getServerSideProps returns selected items when they are in db", async () => {
    const { user, account, session, deleteUser } = await createUser(true)

    const selectedItems = ["1", "2"]
    const startDate = new Date("2023-01-01")
    const endDate = new Date("2023-12-31")

    const userDataId = createId()
    await db.insert(userDatas).values({
      accountId: account.id,
      startDate,
      endDate,
      id: userDataId,
      items: selectedItems.join(","),
    })

    const ctx = getMockApiContext("GET", session.sessionToken, {})
    const props = await getServerSideProps(ctx as any)
    const expectedProps = serialiseDates({
      itemsFilledIn: true,
      dateRange: { startDate: startDate, endDate: endDate },
      selectedItems,
      session: {
        accountId: account.id,
        expires: session.expires.toISOString(),
        user: {
          email: user.email,
          id: user.id,
          name: user.name as string,
        },
      } satisfies Session,
      items: mockResponses.items,
      detailsFilledIn: false,
      companies: [
        { companyName: account.companyName as string, id: account.id },
      ] satisfies LayoutProps["companies"],
      selectedAccountId: session.accountId,
    } as const)
    expect(props).toEqual({ props: expectedProps })

    const doneeInfo = mockDoneeInfo(account.id)
    await db.insert(doneeInfos).values(doneeInfo)

    const props2 = await getServerSideProps(ctx as any)
    expect(props2).toEqual({ props: { ...expectedProps, detailsFilledIn: true } })
  })
})
