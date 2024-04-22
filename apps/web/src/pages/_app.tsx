/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import "./globals.scss"

import { NextSeo } from "next-seo"
import { AppProps } from "next/app"
import Head from "next/head"

import { ErrorBoundary } from "@/components/error"
import { ErrorDisplay } from "@/components/error-display"
import Layout, { LayoutProps } from "@/components/layout"
import { ThemeProvider } from "@/components/theme-provider"
import { config } from "@/lib/env"
import { Toaster } from "components/dist/ui/toast"

export default function App({ Component, pageProps }: AppProps<LayoutProps & Record<string, any>>) {
  const pageTitle =
    config.nodeEnv === "development" || config.nodeEnv === "test"
      ? "[dev] DonationReceipt.Online"
      : "DonationReceipt.Online"

  if (pageProps.error) {
    return (
      <>
        <Head>
          <title>An unexpected error has occured | DonationReceipt.Online</title>
          <meta name="description" content="Expedite your organisation's year-end!" />
        </Head>
        <NextSeo
          title={pageTitle}
          description="Expedite your organisation's year-end!"
          openGraph={{
            url: "https://www.donationreceipt.online",
            images: [
              {
                url: "/open-graph.webp",
                width: 800,
                height: 600,
                alt: "DonationReceipt.Online homepage",
                type: "image/webp",
              },
            ],
          }}
          twitter={{
            cardType: "summary_large_image",
          }}
        />
        <ErrorDisplay error={pageProps.error} />
      </>
    )
  }

  return (
    <>
      <NextSeo
        title={pageTitle}
        description="Expedite your organisation's year-end!"
        openGraph={{
          url: "https://www.donationreceipt.online",
          images: [
            {
              url: "/open-graph.webp",
              width: 800,
              height: 600,
              alt: "DonationReceipt.Online homepage",
              type: "image/webp",
            },
          ],
        }}
        twitter={{
          cardType: "summary_large_image",
        }}
      />
      <Head>
        <title>DonationReceipt.Online</title>
        <meta name="description" content="Expedite your organisation's year-end!" />
      </Head>

      <Toaster />
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <ErrorBoundary>
          <Layout
            session={pageProps.session}
            companies={pageProps.companies}
            selectedAccountId={pageProps.selectedAccountId}
          >
            <Component {...pageProps} />
          </Layout>
        </ErrorBoundary>
      </ThemeProvider>
    </>
  )
}
