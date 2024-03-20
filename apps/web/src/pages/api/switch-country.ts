import { eq } from "drizzle-orm"
import { z } from "zod"

import { SupportedCountries } from "@/lib/intl"
import { AuthorisedHandler, createAuthorisedHandler } from "@/lib/util/request-server"
import { db, users } from "db"
import { parseRequestBody } from "utils/dist/request"

export const parser = z.object({
  country: z
    .string()
    .refine((country): country is SupportedCountries => ["us", "ca", "au", "gb"].includes(country)),
})

export type DataType = z.infer<typeof parser>

const handler: AuthorisedHandler = async (req, res, session) => {
  const { country } = parseRequestBody(parser, req.body)
  await db
    .update(users)
    .set({ country: country as SupportedCountries })
    .where(eq(users.id, session.user.id))
  return res.status(200).json({ ok: true })
}

export default createAuthorisedHandler(handler, ["POST"])
