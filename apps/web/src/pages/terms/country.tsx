const Country = () => (
  <section className="flex min-h-screen flex-col p-4 sm:justify-center">
    <div className="mx-auto max-w-screen-sm px-4 py-8 text-center lg:px-6 lg:py-16">
      <p className="mb-4 text-3xl font-bold tracking-tight md:text-3xl">
        DonationReceipt.Online is not available for your organisation.
      </p>
      <p className="text-muted-foreground mb-8 text-base font-light tracking-wide">
        DonationReceipt.Online is only available for companies based in Canada, The United States,
        The United Kingdom and Australia.
      </p>
    </div>
  </section>
)
export default Country

// --- server-side props ---

export { defaultGetServerSideProps as getServerSideProps } from "@/lib/util/get-server-side-props"
