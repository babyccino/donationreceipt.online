import { and, eq } from "drizzle-orm"
import { NextApiHandler } from "next"
import { getServerSession } from "next-auth"
import { ApiError } from "next/dist/server/api-utils"
import { z } from "zod"

import { serverSignIn } from "@/lib/auth/next-auth-helper-server"
import { config } from "@/lib/env"
import { base64EncodeString } from "utils/dist/image-helper"
import { getResponseContent, parseRequestBody } from "utils/dist/request"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { db, accounts, sessions } from "db"

const {
  qboClientId,
  qboClientSecret,
  qboOauthRevocationEndpoint,
  nextauthSecret: secret,
  vercelEnv,
} = config

async function revokeAccessToken(token: string): Promise<void> {
  console.log("revoking access token")

  const encoded = base64EncodeString(`${qboClientId}:${qboClientSecret}`)
  const response = await fetch(qboOauthRevocationEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/json",
    },
    body: `{"token":"${token}"}`,
  })

  if (!response.ok) {
    throw new ApiError(
      500,
      `access token could not be revoked: ${await getResponseContent(response)}`,
    )
  }
}

export const parser = z.object({
  redirect: z.boolean().default(true),
  reconnect: z.boolean().default(false),
})
export type DisconnectBody = z.input<typeof parser>

const handler: NextApiHandler = async (req, res) => {
  if (!(req.method === "GET" || req.method === "POST")) return res.status(405).end()

  const session = await getServerSession(req, res, authOptions)

  const queryRealmId = req.query["realmId"]
  if (!session || typeof queryRealmId !== "string")
    return await serverSignIn("QBO-disconnected", req, res, true, "/auth/disconnected")

  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.realmId, queryRealmId), eq(accounts.userId, session.user.id)),
    columns: { id: true, accessToken: true },
  })
  if (!account) return await serverSignIn("QBO-disconnected", req, res, true, "/auth/disconnected")

  const shouldRevokeAccessToken = req.query["revoke"] === "true"
  await Promise.all([
    db
      .update(accounts)
      .set({
        accessToken: null,
        expiresAt: null,
        refreshToken: null,
        refreshTokenExpiresAt: null,
        scope: "profile",
      })
      .where(and(eq(accounts.id, account.id))),
    db.update(sessions).set({ accountId: account.id }).where(eq(sessions.userId, session.user.id)),
    // the caller can specify whether or not they want their access token to be disconnected
    // this is because if the user has been disconnected from within QBO then they will have
    // already revoked their tokens
    // if the user is disconnecting from within the application the tokens will need to be
    // revoked by us
    shouldRevokeAccessToken && account.accessToken && revokeAccessToken(account.accessToken),
  ])

  const { redirect, reconnect } = req.body
    ? parseRequestBody(parser, req.body)
    : { redirect: true, reconnect: false }

  // if reconnect is specified user will be re-signed in, without the accounting permissions
  // i.e. signed in, in the `disconnected` state
  // if the user is not signed in they will also need to be signed in, in this state
  if (reconnect || !session) {
    console.log("...reconnecting")
    const redirectUrl = await serverSignIn(
      "QBO-disconnected",
      req,
      res,
      redirect,
      "/auth/disconnected",
    )

    if (redirect) return
    else res.status(200).json({ redirect: redirectUrl })
  } else {
    if (redirect) res.redirect(302, "/auth/disconnected")
    else res.status(200).json({ redirect: "/auth/disconnected" })
  }
}
export default handler
