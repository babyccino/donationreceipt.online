import * as aws from "@aws-sdk/client-ses"
import { render } from "@react-email/render"
import { renderToBuffer } from "@react-pdf/renderer"
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { and, eq } from "drizzle-orm"
import nodemailer from "nodemailer"
import { z } from "zod"

import { WithBody } from "components/dist/receipt/email"
import { ReceiptPdfDocument } from "components/dist/receipt/pdf"
import { db, receipts, storageBucket } from "db"
import { getDonationRange, getThisYear } from "utils/dist/date"
import { bufferToPngDataUrl, downloadImageAsDataUrl } from "utils/dist/db-helper"
import { ApiError } from "utils/dist/error"
import { dataUrlToBase64 } from "utils/dist/image-helper"
import { parseRequestBody } from "utils/dist/request"
import { Donation } from "types"

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
  email: z.string(),
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
  const { emailBody, email: userEmail, campaignId, doneeInfo, userData, donations, counter } = props

  const [[signatureWebpDataUrl, signaturePngDataUrl], [logoWebpDataUrl, logoPngDataUrl]] =
    await Promise.all([
      (async () => {
        const signatureWebpDataUrl = await downloadImageAsDataUrl(
          storageBucket,
          doneeInfo.signature,
        )
        const signaturePngDataUrl = await bufferToPngDataUrl(
          Buffer.from(dataUrlToBase64(signatureWebpDataUrl), "base64"),
        )
        return [signatureWebpDataUrl, signaturePngDataUrl]
      })(),
      (async () => {
        const logoWebpDataUrl = await downloadImageAsDataUrl(storageBucket, doneeInfo.smallLogo)
        const logoPngDataUrl = await bufferToPngDataUrl(
          Buffer.from(dataUrlToBase64(logoWebpDataUrl), "base64"),
        )
        return [logoWebpDataUrl, logoPngDataUrl]
      })(),
    ])

  const doneeWithPngDataUrls: typeof doneeInfo = {
    ...doneeInfo,
    signature: signaturePngDataUrl,
    smallLogo: logoPngDataUrl,
  }

  const doneeWithWebpDataUrls: typeof doneeInfo = {
    ...doneeInfo,
    signature: signatureWebpDataUrl,
    smallLogo: logoWebpDataUrl,
  }

  const signatureCid = "signature"
  const signatureAttachment = {
    filename: getFileNameFromImagePath(doneeInfo.signature as string),
    path: doneeWithWebpDataUrls.signature,
    cid: signatureCid,
  }
  const logoCid = "logo"
  const logoAttachment = {
    filename: getFileNameFromImagePath(doneeInfo.smallLogo as string),
    path: doneeWithWebpDataUrls.smallLogo,
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
      donee: doneeWithPngDataUrls,
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

    // transporter.once("idle", () =>
    //   sendEmail(entry, receiptBuffer, html).catch(_ => receiptSentFailures.push(entry)),
    // )

    try {
      await sendEmail(entry, receiptBuffer, html)
    } catch (e) {
      receiptSentFailures.push(entry)
    }
  }

  async function sendEmail(entry: DonationWithEmail, receiptBuffer: Buffer, html: string) {
    const { messageId, rejected } = await transporter.sendMail({
      from: { address: userEmail, name: companyName },
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
    })

    const dbInsert = db
      .update(receipts)
      .set({
        emailStatus: rejected ? "sent" : "bounced",
        emailId: messageId,
      })
      .where(and(eq(receipts.campaignId, campaignId), eq(receipts.donorId, entry.donorId)))
      .run()

    dbInserts.push(dbInsert)
    receiptSentSuccesses.push({ donation: entry, id: messageId })
  }

  // wait for all tasks to be completed
  await Promise.all(
    donations.map(entry =>
      sendReceipt(entry).catch(_ => receiptCreationFailures.push(entry.donorId)),
    ),
  )

  if (receiptSentFailures.length > 0) {
    const receiptsToSend = receiptSentFailures.slice(0, Infinity)
    for (let i = 0; i < MAX_RESEND_RETRIES; ++i) {
      await Promise.all(
        receiptsToSend.map(entry =>
          sendReceipt(entry).catch(_ => receiptCreationFailures.push(entry.donorId)),
        ),
      )
      if (receiptSentFailures.length === 0) break
    }
  }

  for (const entry of receiptSentFailures) {
    const dbInsert = db
      .update(receipts)
      .set({ emailStatus: "not_sent" })
      .where(and(eq(receipts.campaignId, campaignId), eq(receipts.donorId, entry.donorId)))
      .run()
  }

  await Promise.all(dbInserts)
  // await new Promise<void>(res => transporter.once("idle", () => res()))
}

type DonationWithEmail = Donation & { email: string }

export const lambdaHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  if (!event.body) return { statusCode: 400, body: JSON.stringify({ message: "no body" }) }

  try {
    const body = parseRequestBody(parser, JSON.parse(event.body))
    await sendReceipts(body)

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    }
  } catch (err: any) {
    console.error(err)
    if (err instanceof ApiError) {
      return {
        statusCode: err.statusCode,
        body: JSON.stringify({
          message: err.message,
        }),
      }
    }
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: err.message ?? "an unexpected server error occurred",
      }),
    }
  }
}
