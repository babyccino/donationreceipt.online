import Link from "next/link"

import { Button } from "components/dist/ui/button"

const EmailVerified = () => (
  <section className="flex min-h-screen max-w-xl flex-col p-4 sm:justify-center">
    <div className="mx-auto max-w-screen-sm px-4 py-8 text-center lg:px-6 lg:py-16">
      <p className="mb-4 text-3xl font-bold tracking-tight md:text-3xl">
        Your email is not verified.
      </p>
      <p className="text-muted-foreground mb-4 text-base font-light tracking-wide">
        To use third party QuickBooks Online applications your email must be verified. Click the
        link below to get verified
      </p>
      <Button asChild variant="outline" size="lg" className="cursor-pointer">
        <Link href="https://accounts.intuit.com/app/account-manager/security">
          Verify your email
        </Link>
      </Button>
    </div>
  </section>
)
export default EmailVerified

// --- server-side props ---

export { defaultGetServerSideProps as getServerSideProps } from "@/lib/util/get-server-side-props"
