import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"

import { Connect } from "@/components/qbo"

export default function Disconnected() {
  const searchParams = useSearchParams()
  const callback = searchParams?.get("callback")
  return (
    <section className="flex min-h-screen flex-col p-4 sm:justify-center">
      <div className="mx-auto max-w-screen-sm px-4 py-8 text-center lg:px-6 lg:py-16">
        <p className="mb-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl dark:text-white">
          QuickBooks Online disconnected.
        </p>
        <p className="mb-6 text-lg font-light text-gray-500 dark:text-gray-400">
          Your QuickBooks integration has been disconnected with your current company. Click below
          to reconnect:
        </p>
        <button
          className="mx-auto inline-block"
          onClick={async e => await signIn("QBO", { callbackUrl: "/" + (callback ?? "") })}
        >
          <Connect />
        </button>
      </div>
    </section>
  )
}

// --- get server side props --- //

export { defaultGetServerSideProps as getServerSideProps } from "@/lib/util/get-server-side-props"
