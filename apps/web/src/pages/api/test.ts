import { createId } from "@paralleldrive/cuid2"
import { db, sessions } from "db"
import { NextApiHandler } from "next"

const handler: NextApiHandler = async (req, res) => {
  await db.insert(sessions).values({
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
    id: createId(),
    sessionToken: "test",
    userId: "test",
  })
  res.json({ ok: true })
}
export default handler
