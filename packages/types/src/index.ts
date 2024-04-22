export type Donation = {
  name: string
  donorId: string
  total: number
  items: { name: string; id: string; total: number }[]
  address: string
  email: string | null
}
export type DonationWithoutAddress = Omit<Donation, "address" | "email">

export type EmailStatus =
  | "not_sent"
  | "sent"
  | "delivered"
  | "delivery_delayed"
  | "complained"
  | "bounced"
  | "opened"
  | "clicked"
