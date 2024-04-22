import { captureException } from "@sentry/nextjs"
import { NextApiHandler, NextApiRequest, NextApiResponse } from "next"
import { Session, getServerSession } from "next-auth"

import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { ApiError } from "utils/dist/error"

export type AuthorisedHandler<T = any> = (
  req: NextApiRequest,
  res: NextApiResponse<T>,
  session: Session,
) => Promise<unknown>
type HttpVerb = "POST" | "GET" | "PUT" | "PATCH" | "DELETE"
type ErrorTypes = { message: string } | ApiError
export function createAuthorisedHandler<T>(
  handler: AuthorisedHandler<T>,
  methods: HttpVerb[],
  redirect?: string,
): NextApiHandler<T | ErrorTypes> {
  return async (req, res) => {
    console.log(`${req.method} request made to ${req.url}`)
    if (!req.method || !methods.includes(req.method as HttpVerb)) {
      return res.status(405).end()
    }

    const session = await getServerSession(req, res, authOptions)
    if (!session && redirect) {
      return res.redirect(302, redirect)
    }

    if (!session) {
      return res.status(401).end()
    }

    try {
      await handler(req, res, session)
    } catch (error) {
      captureException(error)
      console.error(error)
      if (!(error instanceof ApiError)) return res.status(500).send("unknown server error" as any)
      const serialisedError: any = {}
      if (error.message) serialisedError.message = error.message
      if (error.stack) serialisedError.stack = error.stack
      if (error.statusCode) serialisedError.statusCode = error.statusCode
      res.status(error.statusCode).json(serialisedError)
    }
  }
}
