import { createId } from "@paralleldrive/cuid2"
import { eq } from "drizzle-orm"

import {
  ColData,
  Customer,
  CustomerQueryResult,
  CustomerSalesReport,
  CustomerSalesReportRow,
  Item,
  ItemQueryResponse,
  ItemQueryResponseItem,
  SalesRow,
  SalesTotalsRow,
} from "@/types/qbo-api"
import {
  Receipt,
  accounts,
  billingAddresses,
  campaigns,
  db,
  doneeInfos,
  prices,
  products,
  receipts,
  sessions,
  subscriptions,
  supportTickets,
  userDatas,
  users,
  verificationTokens,
} from "db"
import { EmailStatus } from "types"
import { endOfPreviousYear, startOfPreviousYear } from "utils/dist/date"
import { getRandomName, randInt } from "utils/dist/etc"
import { toMs } from "utils/dist/time"

const emailStatuses: readonly EmailStatus[] = [
  "bounced",
  "clicked",
  "complained",
  "delivered",
  "delivery_delayed",
  "not_sent",
  "opened",
  "sent",
] as const
function getRandomEmailStatus() {
  return emailStatuses[randInt(0, 7)]
}

type ResMock = {
  getHeader: () => void
  setHeader: () => ResMock
  status: (statusCode: number) => ResMock
  end: () => void
  json: (json: any) => void
}
function getMockApiContext(method: "GET" | "POST", sessionToken: string, body: any | undefined) {
  const req = {
    method,
    cookies: {
      "next-auth.session-token": sessionToken,
    },
    body,
  }
  const res: ResMock = {
    getHeader: () => {},
    setHeader: () => res,
    status: (statusCode: number) => res,
    end: () => {},
    json: (json: any) => {},
  }
  return { req, res }
}

// type ResMock = {
//   getHeader: () => void
//   setHeader: () => ResMock
//   status: Mock<(statusCode: number) => ResMock>
//   end: () => void
//   json: Mock<(json: any) => void>
// }
// export function getMockApiContext(
//   method: "GET" | "POST",
//   sessionToken: string,
//   body: any | undefined,
// ) {
//   const req = {
//     method,
//     cookies: {
//       "next-auth.session-token": sessionToken,
//     },
//     body,
//   }
//   const res: ResMock = {
//     getHeader: () => {},
//     setHeader: () => res,
//     status: mock((statusCode: number) => res),
//     end: () => {},
//     json: mock((json: any) => {}),
//   }
//   return { req, res }
// }

async function createUser(connected: boolean) {
  const threeDaysFromNow = new Date(Date.now() + 3 * toMs.day)
  const userId = createId()
  const accountId = createId()
  const sessionToken = createId()
  const sessionPromise = db
    .insert(sessions)
    .values({
      id: createId(),
      expires: threeDaysFromNow,
      sessionToken,
      accountId,
      userId,
    })
    .returning()
  const userPromise = db
    .insert(users)
    .values({
      id: userId,
      email: Math.round(Math.random() * Math.pow(10, 15)) + "@gmail.com",
      name: "Test User",
      country: "ca",
    })
    .returning()
  const accountPromise = db
    .insert(accounts)
    .values({
      id: accountId,
      provider: connected ? "QBO" : "QBO-disconnected",
      providerAccountId: connected ? "QBO" : "QBO-disconnected",
      type: "oauth",
      userId: userId,
      accessToken: "access-token",
      refreshToken: "refresh-token",
      refreshTokenExpiresAt: threeDaysFromNow,
      companyName: connected ? "Test Company" : null,
      scope: connected ? "accounting" : "profile",
      realmId: connected ? testRealmId : null,
      expiresAt: threeDaysFromNow,
    })
    .returning()
  const [sessionRes, userRes, accountRes] = await Promise.all([
    sessionPromise,
    userPromise,
    accountPromise,
  ])
  if (sessionRes.length !== 1) throw new Error("Expected 1 session to be created")
  if (userRes.length !== 1) throw new Error("Expected 1 user to be created")
  if (accountRes.length !== 1) throw new Error("Expected 1 account to be created")

  const deleteUser = async () => {
    await Promise.all([
      db.delete(sessions).where(eq(sessions.userId, userId)),
      db.delete(users).where(eq(users.id, userId)),
      db.delete(accounts).where(eq(accounts.id, accountId)),
    ])
  }

  return { user: userRes[0], session: sessionRes[0], account: accountRes[0], deleteUser }
}

export async function createFullUser() {
  const threeDaysFromNow = new Date(Date.now() + 3 * toMs.day)
  const userId = createId()
  const accountId = createId()
  const sessionToken = createId()
  const sessionPromise = db
    .insert(sessions)
    .values({
      id: createId(),
      expires: threeDaysFromNow,
      sessionToken,
      accountId,
      userId,
    })
    .returning()

  const userPromise = db
    .insert(users)
    .values({
      id: userId,
      email: Math.round(Math.random() * Math.pow(10, 15)) + "@gmail.com",
      name: "Test User",
      country: "ca",
    })
    .returning()

  const accountPromise = db
    .insert(accounts)
    .values({
      id: accountId,
      provider: "QBO",
      providerAccountId: "QBO",
      type: "oauth",
      userId: userId,
      accessToken: "access-token",
      refreshToken: "refresh-token",
      refreshTokenExpiresAt: threeDaysFromNow,
      companyName: "Test Company",
      scope: "accounting",
      realmId: testRealmId,
      expiresAt: threeDaysFromNow,
    })
    .returning()

  const campaignId = createId()
  const campaignPromise = db
    .insert(campaigns)
    .values({
      id: campaignId,
      accountId,
      endDate: endOfPreviousYear(),
      startDate: startOfPreviousYear(),
      name: "Test Campaign",
    })
    .returning()

  const receiptPromises: any[] = []
  const receiptCount = randInt(15, 20)
  for (let i = 0; i < receiptCount; ++i) {
    const receiptId = createId()
    const name = getRandomName()
    receiptPromises.push(
      db
        .insert(receipts)
        .values({
          id: receiptId,
          campaignId,
          donorId: createId(),
          emailStatus: getRandomEmailStatus(),
          name: name,
          total: randInt(100, 1000),
          emailId: createId(),
          email: `${name}@gmail.com`,
        })
        .returning(),
    )
  }

  const selectedItems = ["1", "2"]
  const startDate = new Date("2023-01-01")
  const endDate = new Date("2023-12-31")
  const userDataId = createId()
  const userDatasPromise = db
    .insert(userDatas)
    .values({
      accountId,
      startDate,
      endDate,
      id: userDataId,
      items: selectedItems.join(","),
    })
    .returning()

  const [sessionRes, userRes, accountRes, campaignRes, userDatasRes, receiptsRes] =
    await Promise.all([
      sessionPromise,
      userPromise,
      accountPromise,
      campaignPromise,
      userDatasPromise,
      Promise.all(receiptPromises as Promise<Receipt[]>[]),
    ])

  if (sessionRes.length !== 1) throw new Error("Expected 1 session to be created")
  if (userRes.length !== 1) throw new Error("Expected 1 user to be created")
  if (accountRes.length !== 1) throw new Error("Expected 1 account to be created")
  if (campaignRes.length !== 1) throw new Error("Expected 1 account to be created")
  if (userDatasRes.length !== 1) throw new Error("Expected 1 account to be created")
  for (const receiptRes of receiptsRes) {
    if (receiptRes.length !== 1) throw new Error("Expected 1 receipt to be created")
  }
}

async function createEmailCampaign(accountId: string, receiptCount: number) {
  const campaignId = createId()
  const campaignPromise = db
    .insert(campaigns)
    .values({
      id: campaignId,
      accountId,
      endDate: endOfPreviousYear(),
      startDate: startOfPreviousYear(),
      name: "Test Campaign",
    })
    .returning()
  const receiptPromises: any[] = []
  for (let i = 0; i < receiptCount; ++i) {
    const receiptId = createId()
    const name = getRandomName()
    receiptPromises.push(
      db
        .insert(receipts)
        .values({
          id: receiptId,
          campaignId,
          donorId: createId(),
          emailStatus: getRandomEmailStatus(),
          name: name,
          total: randInt(100, 1000),
          emailId: createId(),
          email: `${name}@gmail.com`,
        })
        .returning(),
    )
  }

  const [[campaign], receiptList] = await Promise.all([
    campaignPromise,
    Promise.all(receiptPromises).then(res => res.flat()) as Promise<Receipt[]>,
  ])
  if (!campaign) {
    throw new Error("campaign was not created")
  }
  return { campaign, receipts: receiptList }
}

const testRealmId = "123456789"

const deleteAll = () =>
  Promise.all([
    db.delete(sessions),
    db.delete(users),
    db.delete(accounts),
    db.delete(receipts),
    db.delete(doneeInfos),
    db.delete(userDatas),
    db.delete(campaigns),
    db.delete(products),
    db.delete(prices),
    db.delete(billingAddresses),
    db.delete(subscriptions),
    db.delete(supportTickets),
    db.delete(verificationTokens),
  ])

const mockDoneeInfo = (accountId: string) => ({
  id: createId(),
  accountId,
  companyAddress: "123 Fake St",
  companyName: "Apple Co",
  country: "Canada",
  largeLogo: "https://images.com/logo.png",
  smallLogo: "https://images.com/logo.png",
  registrationNumber: "123",
  signatoryName: "John Smith",
  signature: "https://images.com/signature.png",
})

const customerSalesReportHeader = {
  Time: "2023-03-23T14:08:37.242Z",
  ReportName: "Customer Sales Report",
  ReportBasis: "Accrual",
  StartPeriod: "2022-01-01",
  EndPeriod: "2022-12-31",
  SummarizeColumnsBy: "Name",
  Currency: "USD",
  Option: [],
}

const address = {
  Id: "123",
  Line1: "123 Main St",
  City: "San Francisco",
  PostalCode: "94105",
  CountrySubDivisionCode: "CA",
} as const
const customerShared = {
  Taxable: true,
  Job: true,
  BillWithParent: true,
  Balance: 0,
  BalanceWithJobs: 0,
  CurrencyRef: {
    value: "CAD",
    name: "CAD",
  },
  PreferredDeliveryMethod: "shipped",
  domain: "QBO",
  sparse: true,
  SyncToken: "123",
  MetaData: {
    CreateTime: "2022-02-13T09:35:48.590Z",
    LastUpdatedTime: "2022-02-13T09:35:48.590Z",
  },
  Id: createId(),
  Active: true,
  PrimaryEmailAddr: {
    Address: "delivered@resend.dev",
  },
  BillAddr: address,
} as const

const itemQueryResponseItemsShared = {
  Active: true,
  Taxable: true,
  UnitPrice: 100,
  Type: "service",
  IncomeAccountRef: {
    value: "123",
    name: "donations",
  },
  PurchaseCost: 0,
  TrackQtyOnHand: false,
  domain: "QBO",
  sparse: true,
  SyncToken: "123",
  MetaData: {
    CreateTime: "2022-02-13T09:35:48.590Z",
    LastUpdatedTime: "2022-02-13T09:35:48.590Z",
  },
} as const

const testEmails = ["success", "bounce", "ooto", "complaint", "suppressionlist"] as const
const testEmailDomain = "simulator.amazonses.com"

function createMockResponses(itemCount: number, donorCount: number) {
  const customerSalesReportColumns: CustomerSalesReport["Columns"]["Column"] = [
    {
      ColTitle: "Name",
      ColType: "String",
      MetaData: [
        {
          Name: "ID",
          Value: "123",
        },
      ],
    },
  ]
  const items: Item[] = []
  const itemQueryResponseItems: ItemQueryResponseItem[] = []
  for (let i = 0; i < itemCount; ++i) {
    const name = i + " Donations"
    const id = createId()
    const description = "description"
    items.push({ name, id, description })
    customerSalesReportColumns.push({
      ColTitle: name,
      ColType: "Amount",
      MetaData: [
        {
          Name: "ID",
          Value: id,
        },
      ],
    })
    itemQueryResponseItems.push({
      ...itemQueryResponseItemsShared,
      Id: id,
      Description: description,
      Name: name,
      FullyQualifiedName: name,
    })
  }
  customerSalesReportColumns.push({
    ColTitle: "Total",
    ColType: "Amount",
    MetaData: [],
  })

  const itemTotals = new Array<number>(itemCount).fill(0)
  const cutsomerSalesReportRows: CustomerSalesReportRow[] = []
  const customers: {
    donorId: string
    name: string
    email: string
    donations: {
      name: string
      id: string
      total: number
    }[]
    total: number
  }[] = []
  const customerQueryCustomers: Customer[] = []
  for (let i = 0; i < donorCount; ++i) {
    const name = getRandomName()
    const donorId = createId()
    const email = `${testEmails[i % testEmails.length]}+${donorId}@${testEmailDomain}`

    const [firstName, familyName] = name.split(" ")
    customerQueryCustomers.push({
      ...customerShared,
      Id: donorId,
      GivenName: firstName,
      MiddleName: firstName,
      FamilyName: familyName,
      DisplayName: name,
      FullyQualifiedName: name,
      PrintOnCheckName: name,
      Active: true,
      PrimaryEmailAddr: {
        Address: email,
      },
      BillAddr: address,
    })

    const colData: ColData[] = [{ value: name, id: donorId }]
    let total = 0
    const donations: (typeof customers)[number]["donations"] = []
    for (let j = 0; j < itemCount; ++j) {
      if (Math.random() > 0.7) {
        colData.push({ value: "0.00", id: "" })
        continue
      }
      const mag = randInt(1, 4)
      const balance = Math.floor(Math.random() * Math.pow(10, mag))
      total += balance
      itemTotals[j] += balance
      colData.push({ value: `${balance}.00`, id: "" })
      donations.push({ name: items[j].name, id: items[j].id, total: balance })
    }
    colData.push({ value: `${total}.00`, id: "" })
    cutsomerSalesReportRows.push({ ColData: colData } satisfies SalesRow)
    customers.push({ name, email, donorId, donations, total })
  }
  const totalsColData = itemTotals.map(total => ({ value: `${total}.00` }))
  totalsColData.unshift({ value: "TOTAL" })
  const totalDonations = itemTotals.reduce((prev, curr) => prev + curr)
  totalsColData.push({ value: `${totalDonations}.00` })
  const totalRow: SalesTotalsRow = {
    group: "GrandTotal",
    Summary: { ColData: totalsColData },
    type: "Section",
  }
  cutsomerSalesReportRows.push(totalRow)

  const customerQueryResult: CustomerQueryResult = {
    QueryResponse: {
      Customer: customerQueryCustomers,
      maxResults: donorCount,
      startPosition: 0,
    },
    time: "2024-02-13T09:35:48.590Z",
  }

  const customerSalesReport: CustomerSalesReport = {
    Header: customerSalesReportHeader,
    Columns: { Column: customerSalesReportColumns },
    Rows: { Row: cutsomerSalesReportRows },
  }

  const itemQueryResponse: ItemQueryResponse = {
    QueryResponse: { Item: itemQueryResponseItems, maxResults: itemCount, startPosition: 0 },
    time: "2024-02-13T09:35:48.590Z",
  }

  return { items, customers, itemQueryResponse, customerQueryResult, customerSalesReport }
}

const mockResponses = createMockResponses(15, 30)
export {
  createEmailCampaign,
  createMockResponses,
  createUser,
  deleteAll,
  getMockApiContext,
  mockDoneeInfo,
  mockResponses,
  testRealmId,
}
