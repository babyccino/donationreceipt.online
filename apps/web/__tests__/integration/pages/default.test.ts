import { beforeEach, describe, expect, test } from "bun:test"

import { LayoutProps } from "@/components/layout"
import { createUser, deleteAll, getMockApiContext } from "../mocks"

import { defaultGetServerSideProps } from "@/lib/util/get-server-side-props"
import { accounts, db } from "db"
import { createId } from "@paralleldrive/cuid2"
import { toMs } from "utils/dist/time"

describe("items page defaultGetServerSideProps", () => {
  beforeEach(deleteAll)

  test("defaultGetServerSideProps returns null when user is not signed in", async () => {
    const ctx = getMockApiContext("GET", "", {})
    const props = await defaultGetServerSideProps(ctx as any)
    expect(props).toEqual({
      props: { session: null },
    })
  })

  test("defaultGetServerSideProps returns expected data when user is signed in", async () => {
    {
      const { session, user, deleteUser, account } = await createUser(false)
      const ctx = getMockApiContext("GET", session.sessionToken, {})
      const props = await defaultGetServerSideProps(ctx as any)
      expect(props).toEqual({
        props: {
          session: {
            accountId: account.id,
            expires: session.expires.toISOString(),
            user: {
              email: user.email,
              id: user.id,
              name: user.name as string,
            },
          },
        } satisfies LayoutProps,
      })
      await deleteUser()
    }
    {
      const { session, user, account } = await createUser(true)
      const ctx = getMockApiContext("GET", session.sessionToken, {})
      const props = await defaultGetServerSideProps(ctx as any)
      expect(props).toEqual({
        props: {
          session: {
            accountId: account.id,
            expires: session.expires.toISOString(),
            user: {
              email: user.email,
              id: user.id,
              name: user.name as string,
            },
          },
          selectedAccountId: session.accountId,
          companies: [{ companyName: account.companyName as string, id: account.id }],
        } satisfies LayoutProps,
      })
    }
  })

  test("defaultGetServerSideProps switches account when appropriate", async () => {
    const { session, user, deleteUser, account } = await createUser(false)
    const threeDaysFromNow = new Date(Date.now() + 3 * toMs.day)
    const [newAccount] = await db
      .insert(accounts)
      .values({
        id: createId(),
        provider: "QBO",
        providerAccountId: "QBO",
        type: "oauth",
        userId: user.id,
        accessToken: "access-token",
        refreshToken: "refresh-token",
        refreshTokenExpiresAt: threeDaysFromNow,
        companyName: "Test Company",
        scope: "accounting",
        realmId: "testRealmId",
        expiresAt: threeDaysFromNow,
      })
      .returning()
    if (!newAccount) throw new Error("newAccount is null")
    const ctx = getMockApiContext("GET", session.sessionToken, {})
    const props = await defaultGetServerSideProps(ctx as any)
    expect(props).toEqual({
      props: {
        session: {
          accountId: newAccount.id,
          expires: session.expires.toISOString(),
          user: {
            email: user.email,
            id: user.id,
            name: user.name as string,
          },
        },
        selectedAccountId: newAccount.id,
        companies: [{ companyName: newAccount.companyName as string, id: newAccount.id }],
      } satisfies LayoutProps,
    })

    const props2 = await defaultGetServerSideProps(ctx as any)
    expect(props2).toEqual(props)
  })
})
