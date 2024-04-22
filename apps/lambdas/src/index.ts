import * as aws from "@aws-sdk/client-ses"
import { render } from "@react-email/render"
import { renderToBuffer } from "@react-pdf/renderer"
import { AWSLambda } from "@sentry/serverless"
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { and, eq } from "drizzle-orm"
import nodemailer from "nodemailer"
import Mail from "nodemailer/lib/mailer"
import { z } from "zod"

import { WithBody } from "components/dist/receipt/email"
import { ReceiptPdfDocument } from "components/dist/receipt/pdf"
import { db, receipts } from "db"
import { Donation } from "types"
import { getDonationRange, getThisYear } from "utils/dist/date"
import { parseRequestBody } from "utils/dist/request"
import { config } from "./env"

const sesConfigSet = config.sesConfigSet

if (!sesConfigSet && !(config.nodeEnv === "development" || config.nodeEnv === "test"))
  throw new Error("SES_CONFIG_SET must be set in production")

AWSLambda.init({
  dsn: "https://a7eee9df5205f682427e4adbe29637ea@o4506814407966720.ingest.sentry.io/4506814412947456",
  tracesSampleRate: 1.0,
  environment: config.nodeEnv,
})

export const templateDonorName = "FULL_NAME"
const formatEmailBody = (str: string, donorName: string) =>
  str.replaceAll(templateDonorName, donorName)

const sesClient = new aws.SESClient({
  apiVersion: "2010-12-01",
  region: "us-east-2",
})
// const emailSendingRate = parseInt(config.emailSendingRate)
// if (Number.isNaN(emailSendingRate) || emailSendingRate < 0)
//   throw new Error("emailSendingRate is not a number")
const transporter = nodemailer.createTransport({
  SES: { ses: sesClient, aws },
  // sendingRate: emailSendingRate === 0 ? undefined : emailSendingRate,
})
const MAX_RESEND_RETRIES = 3

const getFileNameFromImagePath = (str: string) => str.split("/")[1]

export const parser = z.object({
  emailBody: z.string(),
  campaignId: z.string(),
  doneeInfo: z.object({
    companyName: z.string(),
    signature: z.string(),
    smallLogo: z.string(),
    country: z.string(),
    companyAddress: z.string(),
    registrationNumber: z.string(),
    signatoryName: z.string(),
    largeLogo: z.string(),
  }),
  userData: z.object({
    items: z.string(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  }),
  donations: z.array(
    z.object({
      name: z.string(),
      donorId: z.string(),
      total: z.number(),
      items: z.array(z.object({ name: z.string(), id: z.string(), total: z.number() })),
      address: z.string(),
      email: z.string(),
    }),
  ),
  counter: z.number(),
})
export type EmailWorkerDataType = z.input<typeof parser>

export async function sendReceipts(props: EmailWorkerDataType) {
  const { emailBody, campaignId, doneeInfo, userData, donations, counter } = props

  const signatureCid = "signature"
  const signatureAttachment = {
    filename: getFileNameFromImagePath(doneeInfo.signature as string),
    path: doneeInfo.signature,
    cid: signatureCid,
  }
  const logoCid = "logo"
  const logoAttachment = {
    filename: getFileNameFromImagePath(doneeInfo.smallLogo as string),
    path: doneeInfo.smallLogo,
    cid: logoCid,
  }
  const doneeWithCidImages = {
    ...doneeInfo,
    signature: `cid:${signatureCid}`,
    smallLogo: `cid:${logoCid}`,
  }

  const { companyName } = doneeInfo

  let newCounter = counter
  const donationRange = getDonationRange(userData.startDate, userData.endDate)
  const dbInserts: Promise<any>[] = []
  const receiptCreationFailures: string[] = []
  const receiptSentFailures: DonationWithEmail[] = []
  const receiptSentSuccesses: { donation: DonationWithEmail; id: string }[] = []

  async function sendReceipt(entry: DonationWithEmail) {
    newCounter += 1
    const props = {
      currency: "CAD",
      currentDate: new Date(),
      donation: entry,
      donationDate: donationRange,
      donee: doneeInfo,
      receiptNo: newCounter,
    }

    const body = formatEmailBody(emailBody, entry.name)
    const receiptBuffer = await renderToBuffer(ReceiptPdfDocument(props))

    const html = render(
      WithBody({
        ...props,
        donee: doneeWithCidImages,
        body,
      }),
    )

    // if using sendingRate option
    // transporter.once("idle", () =>
    //   sendEmail(entry, receiptBuffer, html).catch(_ => receiptSentFailures.push(entry)),
    // )

    try {
      await sendEmail(entry, receiptBuffer, html)
    } catch (e) {
      console.error(e)
      receiptSentFailures.push(entry)
    }
  }

  async function sendEmail(entry: DonationWithEmail, receiptBuffer: Buffer, html: string) {
    const headers: Mail.Headers = {
      "X-DATA-CAMPAIGN-ID": campaignId,
      "X-DATA-DONOR-ID": entry.donorId,
    }
    if (sesConfigSet && sesConfigSet !== "test_val")
      headers["X-SES-CONFIGURATION-SET"] = sesConfigSet
    const awsRes = await transporter.sendMail({
      from: { address: `noreply@${config.domain}`, name: companyName },
      to: entry.email,
      subject: `Your ${getThisYear()} ${companyName} Donation Receipt`,
      attachments: [
        {
          filename: `Donation Receipt.pdf`,
          content: receiptBuffer,
          contentType: "application/pdf",
        },
        signatureAttachment,
        logoAttachment,
      ],
      html,
      headers,
    })

    const dbInsert = db
      .update(receipts)
      .set({
        emailStatus: "sent",
        emailId: awsRes.messageId,
      })
      .where(and(eq(receipts.campaignId, campaignId), eq(receipts.donorId, entry.donorId)))
      .run()

    dbInserts.push(dbInsert)
    receiptSentSuccesses.push({ donation: entry, id: awsRes.messageId })
  }

  // wait for all tasks to be completed
  await Promise.all(
    donations.map(entry =>
      sendReceipt(entry).catch(err => {
        console.error("error sending receipt: ", err)
        console.error("entry: ", entry)
        receiptCreationFailures.push(entry.donorId)
      }),
    ),
  )

  console.log(
    `sent ${receiptSentSuccesses.length} receipts successfully\n${receiptSentFailures.length} failed to send\n${receiptCreationFailures.length} failed to create\n`,
  )

  // if (receiptSentFailures.length > 0) {
  //   const receiptsToSend = receiptSentFailures.slice(0, Infinity)
  //   for (let i = 0; i < MAX_RESEND_RETRIES; ++i) {
  //     await Promise.all(
  //       receiptsToSend.map(entry =>
  //         sendReceipt(entry).catch(_ => receiptCreationFailures.push(entry.donorId)),
  //       ),
  //     )
  //     if (receiptSentFailures.length === 0) break
  //   }
  // }

  // pretty sure I don't have to do this as receipts are all saved to the db with not_sent anyway
  // if (receiptSentFailures.length > 0) {
  //   const dbInsert = db
  //     .update(receipts)
  //     .set({ emailStatus: "not_sent" })
  //     .where(
  //       and(
  //         eq(receipts.campaignId, campaignId),
  //         inArray(
  //           receipts.donorId,
  //           receiptSentFailures.map(d => d.donorId),
  //         ),
  //       ),
  //     )
  //     .run()
  //   dbInserts.push(dbInsert)
  // }

  await Promise.all(dbInserts)
  // if using sendingRate option
  // await new Promise<void>(res => transporter.once("idle", () => res()))
}

type DonationWithEmail = Donation & { email: string }

export async function _handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    console.error("returned 400: no body")
    return { statusCode: 400, body: JSON.stringify({ message: "no body" }) }
  }

  try {
    if (typeof event.body !== "object" && typeof event.body !== "string") {
      console.error("event.body must be an object or a string:", event.body)
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Body must be an object or string" }),
      }
    }
    const rawBody = typeof event.body === "string" ? JSON.parse(event.body) : event.body
    if (rawBody.ping) {
      console.log("pinged")
      return { statusCode: 200, body: JSON.stringify({ pong: true }) }
    }

    console.time("in:")

    const body = parseRequestBody(parser, rawBody)
    await sendReceipts(body)

    console.log(`sent ${body.donations.length} receipts`)
    console.timeEnd("in:")
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    }
  } catch (err: any) {
    console.error(err)
    return {
      statusCode: err?.statusCode ?? 500,
      body: JSON.stringify({
        message: err?.message ?? "Internal Server Error",
        stack: err?.stack ?? "No stack trace available",
      }),
    }
  }
}
export const handler = AWSLambda.wrapHandler(_handler)
