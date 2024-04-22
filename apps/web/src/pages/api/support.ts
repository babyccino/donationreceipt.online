import * as aws from "@aws-sdk/client-ses"
import { createId } from "@paralleldrive/cuid2"
import { and, eq, gt, sql } from "drizzle-orm"
import { ApiError } from "utils/dist/error"
import nodemailer from "nodemailer"
import { z } from "zod"

import { config } from "@/lib/env"
import { regularCharacterRegex } from "@/lib/util/regex"
import { AuthorisedHandler, createAuthorisedHandler } from "@/lib/util/request-server"
import { db, supportTickets } from "db"
import { parseRequestBody } from "utils/dist/request"

const sesClient = new aws.SESClient({
  apiVersion: "2010-12-01",
  region: "us-east-2",
})
const transporter = nodemailer.createTransport({
  SES: { ses: sesClient, aws },
  // sendingRate: emailSendingRate === 0 ? undefined : emailSendingRate,
})

const DAY_LENGTH_MS = 1000 * 60 * 60 * 24

export const parser = z.object({
  from: z.string().email(),
  subject: z.string().min(5).regex(regularCharacterRegex),
  body: z.string().min(5),
})
export type DataType = z.infer<typeof parser>

const domain = config.domain.replace("https://", "").replace("http://", "").replace("www.", "")

const handler: AuthorisedHandler = async (req, res, session) => {
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.userId, session.user.id),
        gt(supportTickets.createdAt, new Date(Date.now() - DAY_LENGTH_MS)),
      ),
    )
  if (!row) throw new ApiError(500, "sql query failed")
  if (row.count >= 3)
    throw new ApiError(429, "User may only make 3 support requests in a 24 hr period")

  const data = parseRequestBody(parser, req.body)

  await Promise.all([
    transporter.sendMail({
      from: `contact@${domain}`,
      to: config.supportEmail,
      subject: `A user submitted a support ticket: ${data.subject}`,
      replyTo: data.from,
      html: data.body,
    }),
    db.insert(supportTickets).values({
      ...data,
      id: createId(),
      userId: session.user.id,
    }),
  ])

  return res.status(200).json({ ok: true })
}
export default createAuthorisedHandler(handler, ["POST"])
