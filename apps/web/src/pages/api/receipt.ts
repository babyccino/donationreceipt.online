import { and, eq, sql } from "drizzle-orm"
import JSZip from "jszip"
import { ApiError } from "next/dist/server/api-utils"

import { ReceiptPdfDocument } from "components/dist/receipt/pdf"
import { db, accounts, campaigns } from "db"
import { storageBucket } from "db/dist/firebase"
import { downloadImagesForDonee } from "utils/dist/db-helper"
import { refreshTokenIfNeeded } from "@/lib/auth/next-auth-helper-server"
import { getDonations } from "@/lib/qbo-api"
import { getDonationRange, getThisYear } from "utils/dist/date"
import { AuthorisedHandler, createAuthorisedHandler } from "@/lib/util/request-server"
import { renderToBuffer } from "@react-pdf/renderer"

const handler: AuthorisedHandler = async (req, res, session) => {
  if (!session.accountId) throw new ApiError(401, "user not connected")

  const [account, counterQuery] = await Promise.all([
    db.query.accounts.findFirst({
      where: eq(accounts.id, session.accountId),
      columns: {
        id: true,
        accessToken: true,
        realmId: true,
        createdAt: true,
        expiresAt: true,
        refreshToken: true,
        refreshTokenExpiresAt: true,
        scope: true,
      },
      with: {
        userData: {
          columns: {
            items: true,
            startDate: true,
            endDate: true,
          },
        },
        doneeInfo: {
          columns: {
            accountId: false,
            createdAt: false,
            id: false,
            updatedAt: false,
          },
        },
      },
    }),
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(campaigns)
      .where(and(eq(campaigns.accountId, session.user.id))),
  ])

  if (!account) throw new ApiError(401, "account not found for given userid and company realmid")
  if (!account.realmId) throw new ApiError(401, "user not connected")

  const { doneeInfo, userData } = account
  if (!account || account.scope !== "accounting" || !account.accessToken)
    throw new ApiError(401, "client not qbo-connected")

  if (!doneeInfo || !userData) throw new ApiError(400, "Data missing from user")

  await refreshTokenIfNeeded(account)

  const [donations, donee] = await Promise.all([
    getDonations(
      account.accessToken,
      account.realmId,
      { startDate: userData.startDate, endDate: userData.endDate },
      userData.items ? userData.items.split(",") : [],
    ),
    downloadImagesForDonee(doneeInfo, storageBucket),
  ])

  if (counterQuery.length !== 1) throw new ApiError(500, "counter query returned more than one row")
  let counter = counterQuery[0].count + 1

  const donationDate = getDonationRange(userData.startDate, userData.endDate)
  const zip = new JSZip()
  for (const entry of donations) {
    const buffer = await renderToBuffer(
      ReceiptPdfDocument({
        currency: "CAD",
        currentDate: new Date(),
        donation: entry,
        donationDate,
        donee,
        receiptNo: getThisYear() * 100000 + counter++,
      }),
    )
    zip.file(`${entry.name}.pdf`, buffer)
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })
  res.setHeader("Content-Type", "application/zip").status(200).send(zipBuffer)
}

export default createAuthorisedHandler(handler, ["GET"])
