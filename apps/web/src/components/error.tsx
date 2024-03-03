import Head from "next/head"
import { ReactNode } from "react"
import { FallbackProps, ErrorBoundary as _ErrorBoundary } from "react-error-boundary"

import { ErrorDisplay } from "./error-display"

const Fallback = ({ error }: FallbackProps) => {
  return (
    <>
      <Head>
        <title>An unexpected error has occured</title>
      </Head>
      <ErrorDisplay error={error} />
    </>
  )
}
export const ErrorBoundary = ({ children }: { children?: ReactNode }) => (
  <_ErrorBoundary FallbackComponent={Fallback}>{children}</_ErrorBoundary>
)
