import { NextApiHandler } from "next"
import { getServerSession } from "next-auth"

import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { serverSignIn } from "@/lib/auth/next-auth-helper-server"

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).end()
  }

  const session = await getServerSession(req, res, authOptions)
  if (session) return res.redirect(302, "/")

  void serverSignIn("QBO", req, res, true)
}
export default handler
