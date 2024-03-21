import NextAuth, { CallbacksOptions, NextAuthOptions, Session } from "next-auth"
import { OAuthConfig } from "next-auth/providers"
import { ApiError } from "next/dist/server/api-utils"

import { DrizzleAdapter } from "@/lib/auth/drizzle-adapter"
import { config } from "@/lib/env"
import { OpenIdUserInfo, QBOProfile, QboAccount } from "@/types/qbo-api"
import { db } from "db"
import { AdapterUser } from "next-auth/adapters"
import { fetchJsonData } from "utils/dist/request"
import { toSeconds } from "utils/dist/time"

const { qboClientId, qboClientSecret, qboWellKnown, qboAccountsBaseRoute, nextauthSecret } = config

export const qboProvider: OAuthConfig<QBOProfile> = {
  id: "QBO",
  name: "QBO",
  clientId: qboClientId,
  clientSecret: qboClientSecret,
  type: "oauth",
  version: "2.0",
  wellKnown: qboWellKnown,
  authorization: {
    params: { scope: "com.intuit.quickbooks.accounting openid profile address email phone" },
  },
  idToken: true,
  checks: ["pkce", "state"],
  profile: profile => ({
    id: profile.sub,
  }),
  allowDangerousEmailAccountLinking: true,
}

export const qboProviderDisconnected: OAuthConfig<QBOProfile> = {
  ...qboProvider,
  id: "QBO-disconnected",
  name: "QBO-disconnected",
  authorization: {
    params: { scope: "openid profile address email phone" },
  },
  allowDangerousEmailAccountLinking: true,
}

type QboCallbacksOptions = CallbacksOptions<QBOProfile, QboAccount>
const signIn: QboCallbacksOptions["signIn"] = async ({ user, account, profile }) => {
  if (!account || !profile) return "/404"

  const { access_token: accessToken } = account
  if (!accessToken) throw new ApiError(500, "access token not provided")

  // realmId will be undefined if the user doesn't have qbo accounting permission
  const { realmid: realmId } = profile
  account.realmId = realmId

  const userInfo = await fetchJsonData<OpenIdUserInfo>(
    `${qboAccountsBaseRoute}/openid_connect/userinfo`,
    { bearer: accessToken as string },
  )
  const { email, givenName: name } = userInfo
  if (typeof email !== "string") throw new ApiError(500, "email not returned by openid request")

  if (!userInfo.emailVerified) return "/terms/email-verified"

  // this is passed to the profile object in the adapter cos nextauth? ¯\_(ツ)_/¯
  user.email = email
  user.name ??= name
  ;(user as AdapterUser).country = userInfo.address.country

  return true
}

const session: QboCallbacksOptions["session"] = async ({ session, user }) => {
  return {
    user: {
      id: user.id ?? session.user.id,
      name: user.name ?? session.user.name,
      email: user.email ?? session.user.email,
      country: (user as AdapterUser).country ?? session.user.country ?? null,
    },
    accountId: session.accountId,
    expires: (session.expires as unknown as Date).toISOString(),
  } satisfies Session
}

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db),
  session: {
    strategy: "database",
    maxAge: 3 * toSeconds.day,
  },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [qboProvider, qboProviderDisconnected],
  theme: {
    colorScheme: "dark",
  },
  callbacks: {
    // @ts-ignore using qbo profile instead of default next-auth profile breaks type for some reason
    signIn,
    session,
  },
  secret: nextauthSecret,
}

export default NextAuth(authOptions)
