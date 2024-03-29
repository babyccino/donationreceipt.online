import { eq } from "drizzle-orm"
import { ApiError } from "utils/dist/error"
import { z } from "zod"

import { AuthorisedHandler, createAuthorisedHandler } from "@/lib/util/request-server"
import { accounts, db, sessions } from "db"
import { parseRequestBody } from "utils/dist/request"
import { AccountStatus, refreshTokenIfNeeded } from "@/lib/auth/next-auth-helper-server"

export const parser = z.object({
  accountId: z.string(),
})

export type DataType = z.infer<typeof parser>

const handler: AuthorisedHandler = async (req, res, session) => {
  const { accountId } = parseRequestBody(parser, req.body)
  const account = await db.query.accounts.findFirst({
    columns: {
      id: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
      refreshTokenExpiresAt: true,
    },
    where: eq(accounts.id, accountId),
  })
  if (!account) throw new ApiError(400, "account with selected company id does not exist")
  const { currentAccountStatus } = await refreshTokenIfNeeded(account)
  if (currentAccountStatus === AccountStatus.RefreshExpired) {
    return res.status(301).json({ redirect: true, destination: "/auth/refresh" })
  }
  await db.update(sessions).set({ accountId }).where(eq(sessions.userId, session.user.id))
  return res.status(200).json({ ok: true })
}

export default createAuthorisedHandler(handler, ["POST"])
