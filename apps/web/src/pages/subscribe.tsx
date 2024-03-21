import { LayoutProps } from "@/components/layout"
import { LoadingButton, PricingCard } from "@/components/ui"
import { SupportedCountries, getCurrency } from "@/lib/intl"
import { subscribe } from "@/lib/util/request"

export default function Subscribe(props: LayoutProps) {
  const currency = props.session?.user.country
    ? getCurrency(props.session.user.country as SupportedCountries)
    : "usd"
  return (
    <section className="p-4 sm:flex sm:min-h-screen sm:flex-row sm:justify-center sm:p-10">
      <div className="border-b border-solid border-slate-700 pb-8 text-white sm:border-b-0 sm:border-r sm:p-14">
        <PricingCard title="Your selected plan" plan="free" currency={currency} />
      </div>
      <div className="pt-8 text-white sm:p-14">
        <PricingCard
          title="Subscribe to use this feature"
          plan="pro"
          button={
            <LoadingButton
              loadingImmediately
              onClick={e => {
                e.preventDefault()
                subscribe("/subscribe")
              }}
            >
              Go pro
            </LoadingButton>
          }
          currency={currency}
        />
      </div>
    </section>
  )
}

// --- server-side props ---

export { defaultGetServerSideProps as getServerSideProps } from "@/lib/util/get-server-side-props"
