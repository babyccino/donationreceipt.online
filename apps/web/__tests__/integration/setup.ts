import { afterAll, beforeAll, beforeEach } from "bun:test"

import { APIGatewayProxyEvent } from "aws-lambda"
import { HttpResponse, http } from "msw"
import { SetupServer, setupServer } from "msw/node"

import { _handler as handler } from "lambdas"
import { makeQueryUrl, makeSalesReportUrl } from "@/lib/qbo-api"
import { config } from "@/lib/env"
import { deleteAll, mockResponses, testRealmId } from "./mocks"

let server: SetupServer
beforeAll(async () => {
  await deleteAll()

  const queryUrl = makeQueryUrl(testRealmId, "query")
  const salesReportUrl = makeSalesReportUrl(testRealmId, {
    startDate: new Date("2022-01-01"),
    endDate: new Date("2022-12-31"),
  })

  const { items, customerQueryResult, itemQueryResponse, customerSalesReport } = mockResponses
  const handlers = [
    http.get(queryUrl, ({ request }) => {
      const url = new URL(request.url)
      const query = url.searchParams.get("query")
      if (!query) return HttpResponse.error()
      if (query.startsWith("select * from Customer")) {
        console.log(
          `request received: ${request.url}, sending back mock response: customerQueryResult`,
        )
        return HttpResponse.json(customerQueryResult)
      }
      if (query.startsWith("select * from Item")) {
        console.log(
          `request received: ${request.url}, sending back mock response: itemQueryResponse`,
        )
        return HttpResponse.json(itemQueryResponse)
      }
      return HttpResponse.error()
    }),
    http.get(salesReportUrl, ({ request }) => {
      console.log(
        `request received: ${request.url}, sending back mock response: customerSalesReport`,
      )
      return HttpResponse.json(customerSalesReport)
    }),
  ]

  if (config.sendEmailsInternal !== "true") {
    handlers.push(
      http.post(config.emailWorkerUrl, async ({ request }) => {
        const rawBody = await request.text()
        const req = { body: rawBody }
        const res = await handler(req as APIGatewayProxyEvent)
        return HttpResponse.json(res.body, { status: res.statusCode })
      }),
    )
  }

  server = setupServer(...handlers)
  server.listen({ onUnhandledRequest: "bypass" })
})

beforeEach(deleteAll)

afterAll(async () => {
  server?.close()
  await deleteAll()
})

if (config.nodeEnv !== "test") {
  throw new Error("This test can only be run in test mode")
}
