import {
  Document,
  PDFDownloadLink,
  Page,
  Image,
  Link,
  Text,
  StyleSheet,
  View,
} from "@react-pdf/renderer"

import { formatDate } from "utils/dist/date"
import { sharedStyle } from "./sharedStyle"
import { EmailProps } from "./types"
import { cn } from "@/utils"
import { buttonVariants } from "@/ui/button"
import { Spinner } from "@/ui/spinner"

const styleSheet = StyleSheet.create({
  ...sharedStyle,
  container: { display: "flex", flexDirection: "column", padding: 30, fontFamily: "Helvetica" },
  headingContainer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heading: { ...sharedStyle.heading },
  smallLogo: {
    height: 50,
    width: 50,
  },
  informationTable: {
    ...sharedStyle.informationTable,
    display: "flex",
    flexDirection: "row",
    paddingTop: 10,
    overflowWrap: "break-word",
    overflow: "visible",
  },
  productTitle: {
    ...sharedStyle.productTitle,
    fontFamily: "Helvetica-Bold",
  },
  totalContainer: {
    height: "48px",
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderColor: "#EEEEEE",
    marginTop: 30,
    fontFamily: "Helvetica-Bold",
  },
  productPriceLargeWrapper: {
    ...sharedStyle.productPriceLargeWrapper,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    borderLeftWidth: "1px",
    borderLeftStyle: "solid",
    borderLeftColor: "#EEEEEE",
  },
  productPriceLarge: {
    ...sharedStyle.productPriceLarge,
    margin: 0,
    fontFamily: "Helvetica-Bold",
  },
  productPrice: {
    ...sharedStyle.productPrice,
    fontFamily: "Helvetica-Bold",
  },
} as any)
const Field = ({
  label,
  content,
}: {
  content: string
  label?: string
  align?: "center" | "right" | "left" | "justify" | "char"
}) => (
  <View style={styleSheet.informationTableColumn}>
    {label && <Text style={styleSheet.informationTableLabel}>{label}</Text>}
    <Text style={styleSheet.informationTableValue}>{content}</Text>
  </View>
)

export function ReceiptPdfDocument({
  donation,
  receiptNo,
  donee,
  donationDate,
  currency,
}: EmailProps) {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency })
  const formatCurrency = formatter.format.bind(formatter)

  if (!donee.registrationNumber) throw new Error("")
  if (!donee.signatoryName) throw new Error("")
  if (!donee.smallLogo) throw new Error("")
  if (!donee.signature) throw new Error("")

  return (
    <Document>
      <Page size="A4" style={styleSheet.container}>
        <View style={styleSheet.headingContainer}>
          <Image style={styleSheet.smallLogo} src={donee.smallLogo} />

          <Text style={styleSheet.heading}>Receipt #{receiptNo}</Text>
        </View>
        <View style={styleSheet.informationTable}>
          <View style={{ width: "50%" }}>
            <Field label="Charity Name" content={donee.companyName} />
            <Field
              label="Charitable Registration Number"
              content={donee.registrationNumber.toString()}
            />
          </View>
          <View style={{ width: "50%" }}>
            <Field label="Address" content={donee.companyAddress} />
          </View>
        </View>
        <View style={[styleSheet.informationTable, { justifyContent: "space-between" }]}>
          <View>
            <Field label="Donations Received" content={donationDate} />
            <Field label="Location Issued" content={donee.country} />
            <Field label="Receipt Issued" content={formatDate(new Date())} />
          </View>
          <View style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <Text style={[styleSheet.text, styleSheet.informationTableValue, { marginRight: 10 }]}>
              {donee.signatoryName}
            </Text>
            <Image style={{ height: 100, margin: 10 }} src={donee.signature} />
          </View>
        </View>
        <View style={styleSheet.informationTable}>
          <View>
            <Field label="Donor Name" content={donation.name} />
            <Field label="Address" content={donation.address} />
          </View>
        </View>
        <View style={styleSheet.productTitleTable}>
          <Text style={styleSheet.productsTitle}>Donations</Text>
        </View>
        <View>
          {donation.items.map(({ name, total, id }) => (
            <View
              key={id}
              style={{ display: "flex", flexDirection: "row", justifyContent: "space-between" }}
            >
              <View style={{ paddingLeft: "22px" }}>
                <Text style={styleSheet.productTitle}>{name}</Text>
                <Text style={styleSheet.productDescription}>{""}</Text>
              </View>

              <View style={styleSheet.productPriceWrapper}>
                <Text style={styleSheet.productPrice}>{formatCurrency(total)}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styleSheet.totalContainer}>
          <Text style={styleSheet.productPriceTotal}>Eligible Gift For Tax Purposes</Text>
          <View style={styleSheet.productPriceLargeWrapper}>
            <Text style={styleSheet.productPriceLarge}>{formatCurrency(donation.total)}</Text>
          </View>
        </View>
        <View style={{ marginTop: 20 }}>
          <Image
            style={[styleSheet.smallLogo, { marginHorizontal: "auto" }]}
            src={donee.smallLogo}
          />
        </View>
        <Text style={styleSheet.footerCopyright}>
          Official donation receipt for income tax purposes
        </Text>
        <Text style={[styleSheet.footerCopyright, { margin: "10px 0 0 0" }]}>
          Canada Revenue Agency:{" "}
          <Link src="https://www.canada.ca/charities-giving">www.canada.ca/charities-giving</Link>
        </Text>
      </Page>
    </Document>
  )
}

export const DownloadReceipt = ({
  fileName,
  receiptProps,
}: {
  fileName: string
  receiptProps: EmailProps
}) => (
  <PDFDownloadLink
    document={<ReceiptPdfDocument {...receiptProps} />}
    fileName={fileName}
    className={cn(buttonVariants({ variant: "ghost" }), "relative")}
  >
    {({ loading }) => (loading ? <Spinner /> : "Download")}
  </PDFDownloadLink>
)
