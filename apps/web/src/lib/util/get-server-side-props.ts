import { accounts, db, sessions } from "db"
import { and, asc, desc, eq, isNotNull } from "drizzle-orm"
import { GetServerSideProps } from "next"
import { getServerSession, Session } from "next-auth"

import { LayoutProps } from "@/components/layout"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { config } from "@/lib/env"

export function interceptGetServerSidePropsErrors<T extends { [key: string]: any }>(
  getServerSideProps: GetServerSideProps<T>,
): GetServerSideProps<T | { error: any }> {
  return async (ctx: any) => {
    if (config.nodeEnv === "test") return await getServerSideProps(ctx)
    try {
      return await getServerSideProps(ctx)
    } catch (error: any) {
      console.error("Error in getServerSideProps: ", error)
      const serialisedError: any = {}
      if (error.message) serialisedError.message = error.message
      if (error.stack) serialisedError.stack = error.stack
      if (error.statusCode) serialisedError.statusCode = error.statusCode
      return { props: { error: serialisedError } }
    }
  }
}
const _defaultGetServerSideProps: GetServerSideProps<LayoutProps> = async ({ req, res }) => {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return { props: { session: null } satisfies LayoutProps }

  const [_, accountList] = await getAccountList(session)

  if (accountList !== null)
    return {
      props: {
        session,
        companies: accountList,
        selectedAccountId: session.accountId as string,
      } satisfies LayoutProps,
    }
  else
    return {
      props: {
        session,
      } satisfies LayoutProps,
    }
}
export const defaultGetServerSideProps = interceptGetServerSidePropsErrors(
  _defaultGetServerSideProps,
)

export async function getAccountList(
  session: Session,
): Promise<[boolean, LayoutProps["companies"]]> {
  const accountList = (await db.query.accounts.findMany({
    columns: { companyName: true, id: true },
    where: and(isNotNull(accounts.companyName), eq(accounts.userId, session.user.id)),
    // get "accounting" accounts first
    orderBy: [asc(accounts.scope), desc(accounts.updatedAt)],
  })) as { companyName: string; id: string }[]

  if (
    accountList.length > 0 &&
    (!session.accountId || !accountList.some(a => a.id === session.accountId))
  ) {
    await db
      .update(sessions)
      .set({ accountId: accountList[0].id })
      .where(eq(sessions.userId, session.user.id))
    session.accountId = accountList[0].id
    return [true, accountList]
  }
  return [false, accountList.length > 0 ? accountList : null]
}
