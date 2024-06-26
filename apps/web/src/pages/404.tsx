import Head from "next/head"
import Link from "next/link"

import { Button } from "components/dist/ui/button"

const FourOhFour = () => (
  <>
    <Head>
      <title>Page Not Found</title>
    </Head>
    <section className="flex min-h-full flex-col justify-center">
      <div className="mx-auto max-w-screen-sm px-4 py-8 text-center lg:px-6 lg:py-16">
        <h1 className="text-primary-600 dark:text-primary-500 mb-4 text-7xl font-extrabold tracking-tight lg:text-9xl">
          404
        </h1>
        <p className="mb-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl dark:text-white">
          Something{"'"}s missing.
        </p>
        <p className="mb-4 text-lg font-light text-gray-500 dark:text-gray-400">
          Sorry, we can{"'"}t find that page. You{"'"}ll find lots to explore on the home page.
        </p>
        <Button asChild variant="outline">
          <Link
            href="/"
            className="bg-primary-600 hover:bg-primary-800 focus:ring-primary-300 dark:focus:ring-primary-900 my-4 inline-flex rounded-lg px-5 py-2.5 text-center text-sm font-medium text-white focus:outline-none focus:ring-4"
          >
            Back to Homepage
          </Link>
        </Button>
      </div>
    </section>
  </>
)
export default FourOhFour
