import { createId } from "@paralleldrive/cuid2"
import { and, desc, eq, gt, isNotNull, or } from "drizzle-orm"
import { LibSQLDatabase } from "drizzle-orm/libsql"
import { Adapter, AdapterAccount, AdapterSession } from "next-auth/adapters"
import { ApiError } from "next/dist/server/api-utils"

import { Schema, accounts, sessions, users, verificationTokens } from "db"
import { oneHrFromNow } from "utils/dist/date"
import { toMs } from "utils/dist/time"
import { getCompanyInfo } from "../qbo-api"
import { refreshTokenIfNeeded } from "./next-auth-helper-server"

const DEFAULT_QBO_REFRESH_PERIOD = 101 * toMs.day

function getCountry(str: string): "us" | "ca" | "au" | "gb" {
  const country = str.toLowerCase()
  if (country.startsWith("ca")) return "ca"
  if (country.startsWith("au")) return "au"
  if (
    country.startsWith("gb") ||
    ["united kingdom", "great britain", "england", "scotland", "wales"].includes(country)
  )
    return "gb"
  return "us"
}

export const DrizzleAdapter = (db: LibSQLDatabase<Schema>): Adapter => ({
  async createUser(userData) {
    const [newUser] = await db
      .insert(users)
      .values({
        ...userData,
        country: userData.country ? getCountry(userData.country) : "ca",
        emailVerified: new Date(),
        id: createId(),
      })
      .returning()
    if (!newUser) throw new Error("User not found")
    return newUser
  },
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return user ?? null
  },
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    return user ?? null
  },
  getUserByAccount(provider, account, profile) {
    return null
    // const realmId = (account.realmId ?? profile.realmid) as string | undefined
    // const [row] = await db
    //   .select({ user: users, account: accounts })
    //   .from(users)
    //   .innerJoin(accounts, eq(users.id, accounts.userId))
    //   .where(
    //     and(
    //       eq(accounts.providerAccountId, account.providerAccountId),
    //       eq(accounts.provider, provider),
    //       realmId ? eq(accounts.realmId, realmId) : undefined,
    //     ),
    //   )
    //   .limit(1)
    // if (!row) return null
    // const { user, account: dbAccount } = row
    // return {
    //   user,
    //   account: { ...dbAccount, scope: dbAccount.scope ?? undefined } satisfies AdapterAccount,
    // }
  },
  async updateUser({ id, emailVerified, country, ...userData }) {
    if (!id) throw new Error("User not found")
    await db
      .update(users)
      .set({ ...userData, country: getCountry(country ?? "") })
      .where(eq(users.id, id))
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!user) throw new Error("User not found")
    return user
  },
  async deleteUser(userId) {
    await db.delete(users).where(eq(users.id, userId))
  },
  async linkAccount(account, profile) {
    if (!account.access_token) throw new ApiError(500, "qbo did not return access code")

    const expiresAt =
      account.expires_at !== undefined ? new Date(account.expires_at * toMs.second) : oneHrFromNow()
    const refreshTokenExpiresMs = account.x_refresh_token_expires_in
      ? (account.x_refresh_token_expires_in as number) * toMs.second
      : DEFAULT_QBO_REFRESH_PERIOD
    const refreshTokenExpiresAt = new Date(Date.now() + refreshTokenExpiresMs)
    const scope = account.provider === "QBO" ? "accounting" : "profile"
    const realmId = (account as any).realmId as string | null | undefined
    if (scope === "accounting" && !realmId)
      throw new ApiError(500, "account has accounting scope but no company realm id")
    const companyInfo =
      scope === "accounting"
        ? await getCompanyInfo(account.access_token, realmId as string)
        : undefined

    const [row] = await db
      .insert(accounts)
      .values({
        id: createId(),
        userId: account.userId,
        realmId: realmId,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        accessToken: account.access_token,
        expiresAt,
        idToken: account.id_token,
        refreshToken: account.refresh_token,
        refreshTokenExpiresAt,
        scope,
        tokenType: account.token_type,
        companyName: companyInfo?.companyName,
      })
      .onConflictDoUpdate({
        target: [accounts.userId, accounts.realmId],
        set: {
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          accessToken: account.access_token,
          expiresAt,
          idToken: account.id_token,
          refreshToken: account.refresh_token,
          refreshTokenExpiresAt,
          scope,
          tokenType: account.token_type,
          updatedAt: new Date(),
        },
      })
      .returning()
    if (!row) throw new Error("User not found")
    await db.update(sessions).set({ accountId: row.id }).where(eq(sessions.userId, account.userId))
    return row as AdapterAccount
  },
  async unlinkAccount({ providerAccountId, provider }) {
    await db
      .delete(accounts)
      .where(
        and(eq(accounts.providerAccountId, providerAccountId), eq(accounts.provider, provider)),
      )
  },
  async createSession(data, account, profile) {
    if (!account.realmId) {
      // find the most recently updated account's realmid and set the
      // if the account used to sign in is not qbo-connected but the user has a qbo-connected account
      // find the most recent one of these accounts and use it
      // also make sure the account has either a valid access token or a valid refresh token
      const dbAccount = await db.query.accounts.findFirst({
        where: and(
          isNotNull(accounts.realmId),
          eq(accounts.userId, data.userId),
          or(gt(accounts.expiresAt, new Date()), gt(accounts.refreshTokenExpiresAt, new Date())),
        ),
        columns: {
          id: true,
          expiresAt: true,
          refreshToken: true,
          accessToken: true,
          refreshTokenExpiresAt: true,
        },
        orderBy: desc(accounts.updatedAt),
      })
      if (dbAccount) {
        // if the account has expired, refresh the access token
        await refreshTokenIfNeeded(dbAccount)
        account.id = dbAccount.id
      }
    }
    const [session] = await db
      .insert(sessions)
      .values({
        id: createId(),
        expires: data.expires ?? new Date(Date.now() + 3 * toMs.day),
        sessionToken: data.sessionToken,
        userId: data.userId,
        accountId: account.id ?? null,
      })
      .returning()
    if (!session) throw new Error("User not found")
    return session
  },
  async getSessionAndUser(sessionToken) {
    const [row] = await db
      .select({
        user: users,
        session: {
          id: sessions.id,
          userId: sessions.userId,
          sessionToken: sessions.sessionToken,
          expires: sessions.expires,
          accountId: sessions.accountId,
        },
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.sessionToken, sessionToken))
      .limit(1)
    if (!row) return null
    const { user, session } = row
    return {
      user,
      session: session satisfies AdapterSession,
    }
  },
  async updateSession(session) {
    const [dbSession] = await db
      .update(sessions)
      .set({ ...session, expires: session.expires ?? oneHrFromNow() })
      .where(eq(sessions.sessionToken, session.sessionToken))
      .returning()
    if (!dbSession) throw new Error("Coding bug: updated session not found")
    return { ...dbSession, expires: new Date(dbSession.expires) }
  },
  async deleteSession(sessionToken) {
    await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken))
  },
  async createVerificationToken(verificationToken) {
    const [dbToken] = await db
      .insert(verificationTokens)
      .values({
        expires: verificationToken.expires.getTime(),
        identifier: verificationToken.identifier,
        token: verificationToken.token,
      })
      .returning()
    if (!dbToken) throw new Error("Coding bug: inserted verification token not found")
    return { ...dbToken, expires: new Date(dbToken.expires) }
  },
  async useVerificationToken({ identifier, token }) {
    const [dbToken] = await db
      .select()
      .from(verificationTokens)
      .where(eq(verificationTokens.token, token))
      .limit(1)
    if (!dbToken) return null
    await db
      .delete(verificationTokens)
      .where(
        and(eq(verificationTokens.token, token), eq(verificationTokens.identifier, identifier)),
      )
    return { ...dbToken, expires: new Date(dbToken.expires) }
  },
})
