import { test, describe, expect } from "bun:test"

import {
  combineCustomerQueries,
  getAddressString,
  createDonationsFromSalesReport,
  addBillingAddressesToDonations,
  formatItemQuery,
  parseCompanyInfo,
  makeSalesReportUrl,
  makeQueryUrl,
} from "@/lib/qbo-api"
import {
  CustomerSalesReport,
  CompanyInfoQueryResult,
  CustomerQueryResult,
  DonationWithoutAddress,
  ItemQueryResponse,
} from "@/types/qbo-api"
import { DeepPartial } from "utils/dist/etc"
import { config } from "@/lib/env"

const Header = Object.freeze({
  Time: "2023-03-23T14:08:37.242Z",
  ReportName: "Customer Sales Report",
  ReportBasis: "Accrual",
  StartPeriod: "2022-01-01",
  EndPeriod: "2022-12-31",
  SummarizeColumnsBy: "Name",
  Currency: "CAD",
  Option: [],
})

describe("createDonationsFromSalesReport", () => {
  test("should convert a report with one customer and one product correctly", () => {
    const report: CustomerSalesReport = {
      Header,
      Columns: {
        Column: [
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
          {
            ColTitle: "Product A",
            ColType: "Amount",
            MetaData: [
              {
                Name: "ID",
                Value: "456",
              },
            ],
          },
          {
            ColTitle: "Total",
            ColType: "Amount",
            MetaData: [],
          },
        ],
      },
      Rows: {
        Row: [
          {
            ColData: [
              {
                value: "John",
                id: "123",
              },
              {
                value: "100.00",
                id: "",
              },
              {
                value: "100.00",
                id: "",
              },
            ],
          },
          {
            Summary: {
              ColData: [
                {
                  value: "TOTAL",
                },
                {
                  value: "100.00",
                },
                {
                  value: "100.00",
                },
              ],
            },
            type: "Section",
            group: "GrandTotal",
          },
        ],
      },
    }

    const expected: DonationWithoutAddress[] = [
      {
        name: "John",
        donorId: "123",
        total: 100.0,
        items: [
          {
            name: "Product A",
            id: "456",
            total: 100.0,
          },
        ],
      },
    ]

    const result = createDonationsFromSalesReport(report, ["456"])
    expect(result).toEqual(expected)
  })

  test("should convert a report with one customer section and one product correctly", () => {
    const report: CustomerSalesReport = {
      Header,
      Columns: {
        Column: [
          {
            ColTitle: "",
            ColType: "Customer",
          },
          {
            ColTitle: "Product A",
            ColType: "Amount",
            MetaData: [
              {
                Name: "ID",
                Value: "456",
              },
            ],
          },
          {
            ColTitle: "Total",
            ColType: "Amount",
            MetaData: [],
          },
        ],
      },
      Rows: {
        Row: [
          {
            Header: {
              ColData: [
                {
                  value: "Jeff",
                  id: "22",
                },
                {
                  value: "100.00",
                },
                {
                  value: "100.00",
                },
              ],
            },
            Rows: {
              Row: [
                {
                  ColData: [
                    {
                      value: "Jeff's Mowing",
                      id: "23",
                    },
                    {
                      value: "",
                    },
                    {
                      value: "",
                    },
                  ],
                  type: "data",
                },
              ],
            },
            Summary: {
              ColData: [
                {
                  value: "Total Jeff",
                },
                {
                  value: "100.00",
                },
                {
                  value: "100.00",
                },
              ],
            },
            type: "Section",
          },
          {
            Summary: {
              ColData: [
                {
                  value: "TOTAL",
                },
                {
                  value: "100.00",
                },
                {
                  value: "100.00",
                },
              ],
            },
            type: "Section",
            group: "GrandTotal",
          },
        ],
      },
    }

    const expected: DonationWithoutAddress[] = [
      {
        name: "Jeff",
        donorId: "22",
        total: 100.0,
        items: [
          {
            name: "Product A",
            id: "456",
            total: 100.0,
          },
        ],
      },
    ]

    const result = createDonationsFromSalesReport(report, ["456"])
    expect(result).toEqual(expected)
  })

  test("selecting item which is not in customer's data gives empty array", () => {
    const report: CustomerSalesReport = {
      Header,
      Columns: {
        Column: [
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
          {
            ColTitle: "Product A",
            ColType: "Amount",
            MetaData: [
              {
                Name: "ID",
                Value: "456",
              },
            ],
          },
          {
            ColTitle: "Total",
            ColType: "Amount",
            MetaData: [],
          },
        ],
      },
      Rows: {
        Row: [
          {
            ColData: [
              {
                value: "John",
                id: "123",
              },
              {
                value: "100.00",
                id: "",
              },
              {
                value: "100.00",
                id: "",
              },
            ],
          },
          {
            Summary: {
              ColData: [
                {
                  value: "TOTAL",
                },
                {
                  value: "100.00",
                },
                {
                  value: "100.00",
                },
              ],
            },
            type: "Section",
            group: "GrandTotal",
          },
        ],
      },
    }

    const result = createDonationsFromSalesReport(report, ["1"])
    expect(result).toEqual([])
  })

  test("should convert a report with multiple items and customers correctly", () => {
    const report: CustomerSalesReport = {
      Header,
      Columns: {
        Column: [
          { ColTitle: "", ColType: "Customer" },
          { ColTitle: "Widget A", ColType: "Amount", MetaData: [{ Name: "ID", Value: "1001" }] },
          { ColTitle: "Widget B", ColType: "Amount", MetaData: [{ Name: "ID", Value: "1002" }] },
          { ColTitle: "Widget C", ColType: "Amount", MetaData: [{ Name: "ID", Value: "1003" }] },
          { ColTitle: "Total", ColType: "Amount", MetaData: [] },
        ],
      },
      Rows: {
        Row: [
          {
            ColData: [
              { value: "Customer A", id: "1" },
              { value: "10.00", id: "" },
              { value: "", id: "" },
              { value: "20.00", id: "" },
              { value: "30.00" },
            ],
          },
          {
            ColData: [
              { value: "Customer B", id: "2" },
              { value: "15.00", id: "" },
              { value: "25.00", id: "" },
              { value: "", id: "" },
              { value: "40.00" },
            ],
          },
          {
            ColData: [
              { value: "Customer C", id: "3" },
              { value: "20.00", id: "" },
              { value: "", id: "" },
              { value: "35.00", id: "" },
              { value: "55.00" },
            ],
          },
          {
            Summary: {
              ColData: [
                {
                  value: "TOTAL",
                },
                {
                  value: "45.00",
                },
                {
                  value: "25.00",
                },
                {
                  value: "55.00",
                },
                {
                  value: "125.00",
                },
              ],
            },
            type: "Section",
            group: "GrandTotal",
          },
        ],
      },
    }

    const expected: DonationWithoutAddress[] = [
      {
        name: "Customer A",
        donorId: "1",
        total: 30,
        items: [
          { name: "Widget A", id: "1001", total: 10 },
          { name: "Widget C", id: "1003", total: 20 },
        ],
      },
      {
        name: "Customer B",
        donorId: "2",
        total: 40,
        items: [
          { name: "Widget A", id: "1001", total: 15 },
          { name: "Widget B", id: "1002", total: 25 },
        ],
      },
      {
        name: "Customer C",
        donorId: "3",
        total: 55,
        items: [
          { name: "Widget A", id: "1001", total: 20 },
          { name: "Widget C", id: "1003", total: 35 },
        ],
      },
    ]

    const result = createDonationsFromSalesReport(report, ["1001", "1002", "1003"])
    expect(result).toEqual(expected)

    const expected2: DonationWithoutAddress[] = [
      {
        name: "Customer A",
        donorId: "1",
        total: 10,
        items: [{ name: "Widget A", id: "1001", total: 10 }],
      },
      {
        name: "Customer B",
        donorId: "2",
        total: 40,
        items: [
          { name: "Widget A", id: "1001", total: 15 },
          { name: "Widget B", id: "1002", total: 25 },
        ],
      },
      {
        name: "Customer C",
        donorId: "3",
        total: 20,
        items: [{ name: "Widget A", id: "1001", total: 20 }],
      },
    ]

    const result2 = createDonationsFromSalesReport(report, ["1001", "1002"])
    expect(result2).toEqual(expected2)
  })
})

describe("getAddress", () => {
  test("should return the correct address string when all fields are present", () => {
    const address = {
      Id: "1",
      Line1: "123 Main St",
      Line2: "Suite 456",
      City: "San Francisco",
      PostalCode: "94105",
      CountrySubDivisionCode: "CA",
      Lat: "37.78688",
      Long: "-122.399",
    }
    const result = getAddressString(address)
    expect(result).toEqual("123 Main St Suite 456, San Francisco 94105 CA")
  })

  test("should return the correct address string when some fields are missing", () => {
    const address = {
      Id: "1",
      Line1: "123 Main St",
      City: "San Francisco",
      PostalCode: "94105",
      CountrySubDivisionCode: "CA",
    }
    const result = getAddressString(address)
    expect(result).toEqual("123 Main St, San Francisco 94105 CA")
  })
})

describe("combineCustomerQueries", () => {
  test("should combine multiple customer queries into one", () => {
    const query1: CustomerQueryResult = {
      QueryResponse: {
        Customer: [
          {
            Taxable: true,
            Job: false,
            BillWithParent: false,
            Balance: 0,
            BalanceWithJobs: 0,
            CurrencyRef: {
              value: "USD",
              name: "United States Dollar",
            },
            PreferredDeliveryMethod: "Print",
            domain: "QBO",
            sparse: false,
            Id: "1",
            SyncToken: "0",
            MetaData: {
              CreateTime: "2022-04-05T20:03:08-07:00",
              LastUpdatedTime: "2022-04-05T20:03:08-07:00",
            },
            GivenName: "John",
            MiddleName: "Q.",
            FamilyName: "Public",
            DisplayName: "John Public",
            FullyQualifiedName: "John Public",
            PrintOnCheckName: "John Public",
            Active: true,
            PrimaryEmailAddr: {
              Address: "john.public@example.com",
            },
            BillAddr: {
              Id: "2",
              Line1: "123 Main St",
              City: "Anytown",
              PostalCode: "12345",
              Lat: "37.4275",
              Long: "-122.1697",
              CountrySubDivisionCode: "CA",
              Line2: "Suite 100",
              Line3: "Floor 2",
            },
            CompanyName: "Public Inc.",
          },
        ],
        startPosition: 0,
        maxResults: 1,
      },
      time: "2022-04-05T20:03:09.216-07:00",
    }

    const query2: CustomerQueryResult = {
      QueryResponse: {
        Customer: [
          {
            Taxable: true,
            Job: false,
            BillWithParent: false,
            Balance: 0,
            BalanceWithJobs: 0,
            CurrencyRef: {
              value: "USD",
              name: "United States Dollar",
            },
            PreferredDeliveryMethod: "Print",
            domain: "QBO",
            sparse: false,
            Id: "2",
            SyncToken: "0",
            MetaData: {
              CreateTime: "2022-04-05T20:03:08-07:00",
              LastUpdatedTime: "2022-04-05T20:03:08-07:00",
            },
            GivenName: "Jane",
            MiddleName: "",
            FamilyName: "Doe",
            DisplayName: "Jane Doe",
            FullyQualifiedName: "Jane Doe",
            PrintOnCheckName: "Jane Doe",
            Active: true,
            PrimaryEmailAddr: {
              Address: "jane.doe@example.com",
            },
            BillAddr: {
              Id: "3",
              Line1: "456 Oak St",
              City: "Smallville",
              PostalCode: "54321",
              Lat: "40.7128",
              Long: "-74.006",
              CountrySubDivisionCode: "NY",
              Line2: "Apt 2B",
            },
            CompanyName: "",
          },
        ],
        startPosition: 0,
        maxResults: 1,
      },
      time: "2022-04-05T20:03:09.216-07:00",
    }

    const combinedQuery = combineCustomerQueries(query1, query2)
    const expected: CustomerQueryResult = {
      QueryResponse: {
        Customer: [
          {
            Taxable: true,
            Job: false,
            BillWithParent: false,
            Balance: 0,
            BalanceWithJobs: 0,
            CurrencyRef: {
              value: "USD",
              name: "United States Dollar",
            },
            PreferredDeliveryMethod: "Print",
            domain: "QBO",
            sparse: false,
            Id: "1",
            SyncToken: "0",
            MetaData: {
              CreateTime: "2022-04-05T20:03:08-07:00",
              LastUpdatedTime: "2022-04-05T20:03:08-07:00",
            },
            GivenName: "John",
            MiddleName: "Q.",
            FamilyName: "Public",
            DisplayName: "John Public",
            FullyQualifiedName: "John Public",
            PrintOnCheckName: "John Public",
            Active: true,
            PrimaryEmailAddr: {
              Address: "john.public@example.com",
            },
            BillAddr: {
              Id: "2",
              Line1: "123 Main St",
              City: "Anytown",
              PostalCode: "12345",
              Lat: "37.4275",
              Long: "-122.1697",
              CountrySubDivisionCode: "CA",
              Line2: "Suite 100",
              Line3: "Floor 2",
            },
            CompanyName: "Public Inc.",
          },
          {
            Taxable: true,
            Job: false,
            BillWithParent: false,
            Balance: 0,
            BalanceWithJobs: 0,
            CurrencyRef: {
              value: "USD",
              name: "United States Dollar",
            },
            PreferredDeliveryMethod: "Print",
            domain: "QBO",
            sparse: false,
            Id: "2",
            SyncToken: "0",
            MetaData: {
              CreateTime: "2022-04-05T20:03:08-07:00",
              LastUpdatedTime: "2022-04-05T20:03:08-07:00",
            },
            GivenName: "Jane",
            MiddleName: "",
            FamilyName: "Doe",
            DisplayName: "Jane Doe",
            FullyQualifiedName: "Jane Doe",
            PrintOnCheckName: "Jane Doe",
            Active: true,
            PrimaryEmailAddr: {
              Address: "jane.doe@example.com",
            },
            BillAddr: {
              Id: "3",
              Line1: "456 Oak St",
              City: "Smallville",
              PostalCode: "54321",
              Lat: "40.7128",
              Long: "-74.006",
              CountrySubDivisionCode: "NY",
              Line2: "Apt 2B",
            },
            CompanyName: "",
          },
        ],
        startPosition: 0,
        maxResults: 2,
      },
      time: "2022-04-05T20:03:09.216-07:00",
    }

    expect(combinedQuery).toEqual(expected)
  })
})

describe("addAddressesToCustomerData", () => {
  const donations: DonationWithoutAddress[] = [
    {
      name: "John",
      donorId: "123",
      total: 100,
      items: [
        { name: "Product 1", id: "1", total: 50 },
        { name: "Product 2", id: "2", total: 50 },
      ],
    },
    {
      name: "Jane",
      donorId: "456",
      total: 200,
      items: [{ name: "Product 3", id: "3", total: 200 }],
    },
  ]

  const customers: DeepPartial<CustomerQueryResult> = {
    QueryResponse: {
      Customer: [
        {
          Id: "123",
          BillAddr: {
            Id: "123",
            Line1: "123 Main St",
            City: "San Francisco",
            PostalCode: "94105",
            CountrySubDivisionCode: "CA",
          },
          PrimaryEmailAddr: { Address: "john@gmail.com" },
        },
        {
          Id: "456",
        },
      ],
      startPosition: 1,
      maxResults: 2,
    },
    time: "2022-03-23T00:02:43.682-07:00",
  }

  test("should add addresses to each donation object", () => {
    const result = addBillingAddressesToDonations(donations, customers as CustomerQueryResult)
    expect(result).toEqual([
      {
        name: "John",
        donorId: "123",
        total: 100,
        items: [
          { name: "Product 1", id: "1", total: 50 },
          { name: "Product 2", id: "2", total: 50 },
        ],
        address: "123 Main St, San Francisco 94105 CA",
        email: "john@gmail.com",
      },
      {
        name: "Jane",
        donorId: "456",
        total: 200,
        items: [{ name: "Product 3", id: "3", total: 200 }],
        address: "No billing address on file",
        email: null,
      },
    ])
  })
})

describe("formatItemQuery", () => {
  test("should fetch item data and return an array of item objects", async () => {
    const itemQueryResponse: DeepPartial<ItemQueryResponse> = {
      QueryResponse: {
        Item: [
          { Id: "1", Name: "Item 1" },
          { Id: "2", Name: "Item 2" },
        ],
      },
    }
    const result = formatItemQuery(itemQueryResponse as ItemQueryResponse)

    // Verify that the function returned the expected result
    expect(result).toEqual([
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
    ])
  })
})

describe("parseCompanyInfo", () => {
  test("should parse company info with legal name and legal address", () => {
    const companyInfoQueryResult: DeepPartial<CompanyInfoQueryResult> = {
      QueryResponse: {
        CompanyInfo: [
          {
            LegalName: "Acme Corp",
            CompanyName: "Acme Corp",
            LegalAddr: {
              Line1: "123 Main St",
              City: "San Francisco",
              CountrySubDivisionCode: "CA",
              PostalCode: "94105",
              Id: "1",
            },
            CompanyAddr: {
              Line1: "456 Market St",
              City: "San Francisco",
              CountrySubDivisionCode: "CA",
              PostalCode: "94105",
              Id: "1",
            },
            Country: "USA",
          },
        ],
      },
    }

    const companyInfo = parseCompanyInfo(companyInfoQueryResult as CompanyInfoQueryResult)

    expect(companyInfo).toEqual({
      companyName: "Acme Corp",
      companyAddress: "123 Main St, San Francisco 94105 CA",
      country: "USA",
    })
  })

  test("should parse company info with company name and company address", () => {
    const companyInfoQueryResult: DeepPartial<CompanyInfoQueryResult> = {
      QueryResponse: {
        CompanyInfo: [
          {
            LegalName: "",
            CompanyName: "Acme Corp",
            CompanyAddr: {
              Line1: "456 Market St",
              City: "San Francisco",
              CountrySubDivisionCode: "CA",
              PostalCode: "94105",
            },
            Country: "USA",
          },
        ],
      },
    }

    const companyInfo = parseCompanyInfo(companyInfoQueryResult as CompanyInfoQueryResult)

    expect(companyInfo).toEqual({
      companyName: "Acme Corp",
      companyAddress: "456 Market St, San Francisco 94105 CA",
      country: "USA",
    })
  })

  test("should throw an error if no company info is found", () => {
    const companyInfoQueryResult: DeepPartial<CompanyInfoQueryResult> = {
      QueryResponse: {
        CompanyInfo: [],
      },
    }

    expect(() => parseCompanyInfo(companyInfoQueryResult as CompanyInfoQueryResult)).toThrow(
      "No company info found",
    )
  })

  test("should parse the company info object correctly when LegalAddr is defined", () => {
    const companyInfoQueryResult: DeepPartial<CompanyInfoQueryResult> = {
      QueryResponse: {
        CompanyInfo: [
          {
            CompanyName: "Test Company",
            LegalName: "Test Legal Name",
            LegalAddr: {
              Line1: "123 Test Street",
              City: "Test City",
              CountrySubDivisionCode: "Test State",
              PostalCode: "12345",
            },
            Country: "Test Country",
            Id: "1234",
          },
        ],
        maxResults: 1,
      },
    }

    const expectedCompanyInfo = {
      companyName: "Test Legal Name",
      companyAddress: "123 Test Street, Test City 12345 Test State",
      country: "Test Country",
    }

    expect(parseCompanyInfo(companyInfoQueryResult as CompanyInfoQueryResult)).toEqual(
      expectedCompanyInfo,
    )
  })

  test("should parse the company info object correctly when LegalAddr is undefined", () => {
    const companyInfoQueryResult: DeepPartial<CompanyInfoQueryResult> = {
      QueryResponse: {
        CompanyInfo: [
          {
            CompanyName: "Test Company",
            Country: "Test Country",
            Id: "1234",
          },
        ],
        maxResults: 1,
      },
    }

    const expectedCompanyInfo = {
      companyName: "Test Company",
      companyAddress: "No address on file",
      country: "Test Country",
    }

    expect(parseCompanyInfo(companyInfoQueryResult as CompanyInfoQueryResult)).toEqual(
      expectedCompanyInfo,
    )
  })

  test("should throw an error if no company info is found", () => {
    const companyInfoQueryResult = {
      QueryResponse: {
        CompanyInfo: [],
        maxResults: 0,
      },
      time: "2022-01-01T00:00:00Z",
    }

    expect(() => {
      parseCompanyInfo(companyInfoQueryResult)
    }).toThrow("No company info found")
  })
})

describe("makeSalesReportUrl", () => {
  test("should generate the correct report URL", () => {
    const realmId = "123456789"
    const startDate = new Date("2022-01-01")
    const endDate = new Date("2022-12-31")

    const result = makeSalesReportUrl(realmId, { startDate, endDate })

    const expected = `${config.qboBaseApiRoute}/company/123456789/reports/CustomerSales?\
summarize_column_by=ProductsAndServices&start_date=2022-01-01&end_date=2022-12-31`
    expect(result).toEqual(expected)
  })
})

describe("makeSalesReportUrl", () => {
  test("makeQueryUrl should return the correct query URL", () => {
    const realmId = "1234567890"
    const query = "SELECT * FROM Customers"
    const expected = `${config.qboBaseApiRoute}/company/${realmId}/query?query=${query}`

    const result = makeQueryUrl(realmId, query)

    expect(result).toEqual(expected)
  })
})
