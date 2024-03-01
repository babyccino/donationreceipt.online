import { DoneeInfo } from "db"

type Donation = {
  name: string
  donorId: string
  total: number
  items: { name: string; id: string; total: number }[]
  address: string
  email: string | null
}

export type EmailProps = {
  donation: Donation
  receiptNo: number
  donee: Omit<DoneeInfo, "accountId" | "createdAt" | "id" | "updatedAt">
  currentDate: Date
  donationDate: string
  currency: string
}
export type EmailWithBodyProps = EmailProps & { body: string }
