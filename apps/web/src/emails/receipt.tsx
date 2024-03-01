import { DonationReceiptEmail } from "components/dist/receipt/email"
import { dummyEmailProps } from "@/emails/props"

const PreviewEmail = () => <DonationReceiptEmail {...dummyEmailProps} />
export default PreviewEmail
