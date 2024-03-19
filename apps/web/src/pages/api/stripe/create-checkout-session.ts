import { eq } from "drizzle-orm"
import { ApiError } from "next/dist/server/api-utils"
import { z } from "zod"

import { config } from "@/lib/env"
import { isUserSubscribed, stripe } from "@/lib/stripe"
import { getBaseUrl } from "@/lib/util/request"
import { AuthorisedHandler, createAuthorisedHandler } from "@/lib/util/request-server"
import { db, subscriptions, users } from "db"
import { parseRequestBody } from "utils/dist/request"

export const parser = z.object({
  redirect: z.string().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
})
export type DataType = z.input<typeof parser>

const handler: AuthorisedHandler = async ({ body }, res, session) => {
  const data = parseRequestBody(parser, body)
  const { metadata, redirect } = data

  const [subscription, user] = await Promise.all([
    db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, session.user.id),
      columns: { status: true, currentPeriodEnd: true },
    }),
    db.query.users.findFirst({where: eq(users.id, session.user.id), select: { email: true }}),
  ])

  if (subscription && isUserSubscribed(subscription))
    throw new ApiError(400, "user already subscribed")


  const stripeSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    billing_address_collection: "required",
    customer_email: session.user.email,
    line_items: [
      {
        price: config.stripeSubscribePriceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    subscription_data: {
      metadata: { ...metadata, clientId: session.user.id },
    },
    success_url: `${getBaseUrl()}/${redirect || ""}`,
    cancel_url: `${getBaseUrl()}/`,
    allow_promotion_codes: true,
    currency:
  })

  if (!stripeSession.url) throw new ApiError(502, "stripe did not send a redirect url")

  res.status(200).json({ url: stripeSession.url })
}

export default createAuthorisedHandler(handler, ["POST"])
