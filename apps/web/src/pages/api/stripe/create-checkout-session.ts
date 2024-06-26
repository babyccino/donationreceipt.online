import { eq } from "drizzle-orm"
import { ApiError } from "utils/dist/error"
import { z } from "zod"

import { config } from "@/lib/env"
import { isUserSubscribed, stripe } from "@/lib/stripe"
import { getBaseUrl } from "@/lib/util/request"
import { AuthorisedHandler, createAuthorisedHandler } from "@/lib/util/request-server"
import { db, users } from "db"
import { parseRequestBody } from "utils/dist/request"
import { getCurrency } from "@/lib/intl"

export const parser = z.object({
  redirect: z.string().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
})
export type DataType = z.input<typeof parser>

const handler: AuthorisedHandler = async (req, res, session) => {
  const data = parseRequestBody(parser, req.body)
  const { metadata, redirect } = data

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { country: true },
    with: { subscription: { columns: { status: true, currentPeriodEnd: true } } },
  })

  if (!user) throw new ApiError(404, "user not found")
  if (user.subscription && isUserSubscribed(user.subscription))
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
    cancel_url: `${getBaseUrl()}/account`,
    allow_promotion_codes: true,
    currency: getCurrency(user.country),
  })

  if (!stripeSession.url) throw new ApiError(502, "stripe did not send a redirect url")

  res.status(200).json({ url: stripeSession.url })
}

export default createAuthorisedHandler(handler, ["POST"])
