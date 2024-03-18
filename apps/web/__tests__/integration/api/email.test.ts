import { describe, expect, mock, test } from "bun:test"

import makeChecksum from "checksum"
import { desc, eq, sql } from "drizzle-orm"
import { NextApiRequest, NextApiResponse } from "next"

import { storageBucket } from "db/dist/firebase"
import { db, campaigns, doneeInfos, receipts, subscriptions, userDatas } from "db"
import { getDonations } from "@/lib/qbo-api"
import { uploadWebpImage } from "utils/dist/image-helper-server"
import handler, { EmailDataType } from "@/pages/api/email"
import { createId } from "@paralleldrive/cuid2"
import { createUser, mockResponses } from "../mocks"

describe("email", () => {
  test("should send email", async () => {
    const { account, session, deleteUser, user } = await createUser(true)

    const selectedItems = mockResponses.items.map(({ id }) => id)
    const startDate = new Date("2023-01-01")
    const endDate = new Date("2023-12-31")

    const path = "test/test.webp"
    const [_, [doneeInfo], [userData], [subscription]] = await Promise.all([
      storageBucket
        .file("test/test.webp")
        .exists()
        .then(async exists => {
          if (exists) return
          const buf = await Bun.file("__tests__/test-files/test.webp").arrayBuffer()
          await uploadWebpImage(storageBucket, Buffer.from(buf), path, true)
        }),
      db
        .insert(doneeInfos)
        .values({
          id: createId(),
          companyAddress: "123 Fake St.",
          companyName: "Charity",
          country: "Canada",
          accountId: account.id,
          registrationNumber: "123456789RR0001",
          signatoryName: "John Smith",
          smallLogo: path,
          largeLogo: path,
          signature: path,
        })
        .returning(),
      db
        .insert(userDatas)
        .values({
          accountId: account.id,
          startDate,
          endDate,
          id: createId(),
          items: selectedItems.join(","),
        })
        .returning(),
      db
        .insert(subscriptions)
        .values({
          id: createId(),
          currentPeriodEnd: new Date("2050-12-31"),
          status: "active",
          currentPeriodStart: new Date("2023-01-01"),
          userId: user.id,
          cancelAtPeriodEnd: false,
        })
        .returning(),
    ])

    const donations = await getDonations(
      account.accessToken as string,
      account.realmId as string,
      { startDate: userData.startDate, endDate: userData.endDate },
      userData.items ? userData.items.split(",") : [],
    )
    const checksum = makeChecksum(JSON.stringify(donations))
    const body: EmailDataType = {
      checksum,
      emailBody: "test email body",
      recipientIds: mockResponses.customers.map(({ donorId }) => donorId),
    }

    const req = {
      method: "POST",
      cookies: {
        "next-auth.session-token": session.sessionToken,
      },
      body,
      headers: { "x-test-wait-for-email-worker": "true" },
    }
    let emailRes: any = undefined
    const json = mock((json: any) => {
      emailRes = json
    })
    const send = mock((json: any) => {})
    let res: any
    const status = mock((statusCode: number) => res)
    res = {
      getHeader: () => {},
      setHeader: () => res,
      end: () => {},
      json,
      send,
      status,
    }
    // const { req, res } = getMockApiContext("POST", session.sessionToken, body)
    const response = await handler(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    )

    expect(json).toHaveBeenCalledWith(expect.anything())
    expect(emailRes.campaignId).toBeDefined()
    expect(status).toHaveBeenCalledWith(200)

    const dbReceipts = await db.query.receipts.findMany()
    expect(dbReceipts.length).toBe(donations.length)

    for (const donor of donations) {
      const receipt = dbReceipts.find(receipt => receipt.donorId === donor.donorId)
      const index = dbReceipts.findIndex(receipt => receipt.donorId === donor.donorId)
      dbReceipts.splice(index, 1)
      expect(receipt).toBeDefined()
      if (!receipt) return
      expect(receipt.campaignId).toBe(emailRes.campaignId)
      expect(receipt.donorId).toBe(donor.donorId)
      expect(receipt.total).toBe(donor.total)
      expect(receipt.emailStatus).toBe("sent")
    }
  })
})
