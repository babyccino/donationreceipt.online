import { createId } from "@paralleldrive/cuid2"
import makeChecksum from "checksum"
import { and, eq, gt, sql } from "drizzle-orm"
import { z } from "zod"

import { refreshTokenIfNeeded } from "@/lib/auth/next-auth-helper-server"
import { config } from "@/lib/env"
import { getDonations } from "@/lib/qbo-api"
import { isUserSubscribed } from "@/lib/stripe"
import { AuthorisedHandler, createAuthorisedHandler } from "@/lib/util/request-server"
import { accounts, campaigns, db, receipts } from "db"
import { storageBucket } from "db/dist/firebase"
import { EmailWorkerDataType, sendReceipts } from "lambdas"
import { Donation } from "types"
import { getThisYear } from "utils/dist/date"
import { ApiError } from "utils/dist/error"
import { parseRequestBody } from "utils/dist/request"
import { bufferToPngDataUrl, downloadImagesForDonee } from "utils/dist/db-helper"
import { dataUrlToBase64 } from "utils/dist/image-helper"

const DAY_LENGTH_MS = 1000 * 60 * 60 * 24

export const parser = z.object({
  emailBody: z.string(),
  recipientIds: z.array(z.string()).refine(arr => arr.length > 0),
  checksum: z.string(),
})
export type EmailDataType = z.input<typeof parser>

type DonationWithEmail = Donation & { email: string }

const handler: AuthorisedHandler = async (req, res, session) => {
  if (!session.accountId) throw new ApiError(401, "user not connected")
  const { emailBody, recipientIds, checksum } = parseRequestBody(parser, req.body)

  const [row] = await Promise.all([
    db.query.accounts
      .findFirst({
        // if the realmId is specified get that account otherwise just get the first account for the user
        where: eq(accounts.id, session.accountId),
        columns: {
          id: true,
          accessToken: true,
          scope: true,
          realmId: true,
          createdAt: true,
          expiresAt: true,
          refreshToken: true,
          refreshTokenExpiresAt: true,
        },
        with: {
          doneeInfo: {
            columns: { accountId: false, createdAt: false, id: false, updatedAt: false },
          },
          userData: { columns: { items: true, startDate: true, endDate: true } },
          user: {
            columns: { email: true },
            with: { subscription: { columns: { status: true, currentPeriodEnd: true } } },
          },
        },
      })
      .then(row => {
        if (!row) throw new ApiError(500, "user not found in db")
        const { doneeInfo, userData, user, ...account } = row
        if (!account || account.scope !== "accounting" || !account.accessToken || !account.realmId)
          throw new ApiError(401, "client not qbo-connected")

        if (!doneeInfo || !userData) throw new ApiError(400, "data missing")

        const { subscription } = user
        if (!subscription || !isUserSubscribed(subscription))
          throw new ApiError(401, "not subscribed")
        if (userData.items === null) throw new ApiError(400, "no items selected")
        return {
          account,
          doneeInfo,
          userData: userData as { items: string; startDate: Date; endDate: Date },
          email: user.email,
        }
      }),
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.accountId, session.accountId),
          gt(campaigns.createdAt, new Date(Date.now() - DAY_LENGTH_MS)),
        ),
      )
      .then(([value]) => {
        if (value.count > 5) throw new ApiError(429, "too many requests")
      }),
  ])

  const { account, doneeInfo, userData, email: userEmail } = row
  const realmId = account.realmId as string

  await refreshTokenIfNeeded(account)

  const donations = await getDonations(
    account.accessToken as string,
    realmId,
    { startDate: userData.startDate, endDate: userData.endDate },
    userData.items ? userData.items.split(",") : [],
  )

  if (makeChecksum(JSON.stringify(donations)) !== checksum)
    throw new ApiError(400, "checksum mismatch")

  // throw if req.body.to is not a subset of the calculated donations
  const donationIdSet = new Set(donations.map(entry => entry.donorId))
  if (recipientIds.some(id => !donationIdSet.has(id)))
    throw new ApiError(
      500,
      `IDs were found in the request body which were not present in the calculated donations for this date range`,
    )

  const recipientIdsSet = new Set(recipientIds)
  const relevantDonations = donations.filter(
    (entry): entry is DonationWithEmail => recipientIdsSet.has(entry.donorId) && Boolean(entry),
  )

  if (relevantDonations.length !== recipientIds.length)
    throw new ApiError(400, "mismatch between ids")

  const campaignId = createId()
  const ops = [
    (async () => {
      const { signature, smallLogo } = await downloadImagesForDonee(doneeInfo, storageBucket)
      const signatureBuffer = Buffer.from(dataUrlToBase64(signature), "base64")
      const smallLogoBuffer = Buffer.from(dataUrlToBase64(smallLogo), "base64")
      const [signaturePng, smallLogoPng] = await Promise.all([
        bufferToPngDataUrl(signatureBuffer),
        bufferToPngDataUrl(smallLogoBuffer),
      ])
      doneeInfo.signature = signaturePng
      doneeInfo.smallLogo = smallLogoPng
      return doneeInfo
    })(),
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(receipts)
      .innerJoin(campaigns, eq(receipts.campaignId, campaigns.id))
      .where(and(eq(campaigns.accountId, session.accountId))),
    db.insert(campaigns).values({
      id: campaignId,
      endDate: userData.endDate,
      startDate: userData.startDate,
      accountId: account.id,
    }),
    ...relevantDonations.map(entry =>
      db.insert(receipts).values({
        id: createId(),
        emailStatus: "not_sent",
        campaignId,
        donorId: entry.donorId,
        email: entry.email as string,
        name: entry.name,
        total: entry.total,
      }),
    ),
  ] as const
  const [doneeInfoWithImages, counterRows] = await Promise.all(ops)

  const counterStart = (counterRows[0]?.count ?? 0) + 1
  const thisYear = getThisYear()
  const counter = thisYear * 100000 + counterStart

  const reqBody: EmailWorkerDataType = {
    emailBody,
    campaignId,
    doneeInfo: doneeInfoWithImages,
    userData,
    donations: relevantDonations,
    counter,
  }

  if (config.nodeEnv === "test" || config.sendEmailsInternal === "true") {
    await sendReceipts(reqBody)
    return res.status(200).json({ campaignId })
  }

  const emailWorkerTask = fetch(config.emailWorkerUrl, {
    body: JSON.stringify({ body: JSON.stringify(reqBody) }),
    method: "POST",
    headers: { "x-api-key": config.emailWorkerApiKey, "Content-Type": "application/json" },
  })
  const awaitEmailTask = req.headers["x-test-wait-for-email-worker"] === "true"
  if (true) {
    const workerTaskRes = await emailWorkerTask
    const json = await workerTaskRes.json()
    if (!workerTaskRes.ok || json.statusCode === "500" || json.statusCode === "400")
      return res.status(workerTaskRes.status).json(json)
  }

  res.status(200).json({ campaignId })
}

export default createAuthorisedHandler(handler, ["POST"])
