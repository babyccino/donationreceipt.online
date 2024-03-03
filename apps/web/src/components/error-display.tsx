import { DumbLink } from "components/dist/dumb-link"

export const ErrorDisplay = ({ error }: { error: Error }) => {
  return (
    <section className="flex min-h-full flex-col justify-center">
      <div className="mx-auto max-w-screen-lg px-4 py-8 text-center lg:px-6 lg:py-16">
        <p className="mb-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl dark:text-white">
          An unexpected error has occured
        </p>
        <p className="mb-4 text-lg font-light text-gray-500 dark:text-gray-400">
          If this error persists, please contact an administrator.
        </p>
        {error.message && (
          <p className="mb-4 text-lg font-light text-gray-500 dark:text-gray-400">
            Error {(error as any).statusCode ?? ""}: {error.message}
          </p>
        )}
        <DumbLink href="/support">Contact support</DumbLink>
        {error.stack && (
          <pre className="mt-4 overflow-x-scroll rounded-md border-4 border-zinc-600 bg-zinc-900 p-2 text-left font-mono text-sm text-green-400">
            {error.stack}
          </pre>
        )}
      </div>
    </section>
  )
}
