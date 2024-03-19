import {
  ArrowLeftOnRectangleIcon,
  ArrowRightOnRectangleIcon,
  Bars3BottomLeftIcon,
  BuildingOfficeIcon,
  ChatBubbleLeftEllipsisIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  InformationCircleIcon,
  PlusSmallIcon,
  RectangleGroupIcon,
  RectangleStackIcon,
  ShoppingBagIcon,
  TableCellsIcon,
  UserCircleIcon,
  UserPlusIcon,
} from "@heroicons/react/24/solid"
import { Session } from "next-auth"
import { signIn, signOut } from "next-auth/react"
import Link from "next/link"
import { NextRouter, useRouter } from "next/router"
import { MouseEventHandler, ReactNode, useEffect, useState } from "react"

import { subscribe } from "@/lib/util/request"
import { DataType } from "@/pages/api/switch-company"
import { fetchJsonData } from "utils/dist/request"

export type LayoutProps = {
  session: Session | null
  companies?: { companyName: string; id: string }[] | null
  selectedAccountId?: string | null
}

export default function Layout(
  props: {
    children: ReactNode
  } & LayoutProps,
) {
  const router = useRouter()
  const { children, session } = props
  const user = session?.user
  const [showSidebar, setShowSidebar] = useState(false)
  const [loading, setLoading] = useState(false)

  const companies = props.companies?.length ? props.companies : undefined
  const otherCompanies = companies?.filter(company => company.id !== props.selectedAccountId)
  const companyName =
    companies?.find(company => company.id === props.selectedAccountId)?.companyName ??
    "Select Company"

  useEffect(() => {
    const routeChangeStartCb = () => {
      setShowSidebar(false)
      setLoading(true)
    }
    const routeChangeEndCb = () => setLoading(false)
    router.events.on("routeChangeStart", routeChangeStartCb)
    router.events.on("routeChangeComplete", routeChangeEndCb)
    return () => {
      router.events.off("routeChangeStart", routeChangeStartCb)
      router.events.off("routeChangeComplete", routeChangeEndCb)
    }
  }, [router.events])

  return (
    <div className="relative flex flex-col sm:flex-row">
      <header>
        <button
          aria-controls="separator-sidebar"
          type="button"
          className="ml-3 mt-2 inline-flex items-center rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 sm:hidden dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
          onClick={() => setShowSidebar(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Bars3BottomLeftIcon className="h-6 w-6" />
        </button>
        {showSidebar && (
          <div
            className="animate-fadeIn fixed inset-0 z-20 bg-black/40"
            onClick={() => setShowSidebar(false)}
          />
        )}
        <nav
          id="separator-sidebar"
          className={
            "fixed left-0 top-0 z-40 flex h-screen w-64 flex-col justify-between overflow-y-auto bg-gray-50 px-3 py-4 transition-transform sm:translate-x-0 dark:bg-gray-800 " +
            "fixed left-0 top-0 z-40 flex h-screen w-64 flex-col justify-between overflow-y-auto bg-gray-50 px-3 py-4 transition-transform sm:translate-x-0 dark:bg-gray-800 " +
            (showSidebar ? "" : " -translate-x-full")
          }
          aria-label="Sidebar"
        >
          {companies && (
            <>
              <Companies
                companyName={companyName}
                otherCompanies={otherCompanies}
                router={router}
              />
              <hr
                style={{ margin: "1rem 0" }}
                className="border-t border-gray-200 dark:border-gray-700"
              />
            </>
          )}
          <ul className="h-full space-y-2 font-medium">
            {user && (
              <>
                <NavLink link="/" logo={<RectangleGroupIcon />} label="Dashboard" />
                <NavLink link="/items" logo={<ShoppingBagIcon />} label="Items" />
                <NavLink link="/details" logo={<RectangleStackIcon />} label="Details" />
                <NavLink link="/generate-receipts" logo={<TableCellsIcon />} label="Receipts" />
                <NavLink link="/email" logo={<EnvelopeIcon />} label="Email" />
                <NavLink link="/account" logo={<UserCircleIcon />} label="Account" />
                <hr
                  style={{ margin: "1rem 0" }}
                  className="border-t border-gray-200 dark:border-gray-700"
                />
              </>
            )}

            {user ? (
              <NavAnchor
                href="/api/auth/signout"
                logo={<ArrowLeftOnRectangleIcon />}
                onClick={e => {
                  e.preventDefault()
                  signOut()
                }}
                label="Sign Out"
              />
            ) : (
              <NavLink
                link={`/auth/signin?callback=${router.asPath}`}
                logo={<ArrowRightOnRectangleIcon />}
                label="Sign In"
              />
            )}
            {user && (
              <NavAnchor
                href="#"
                onClick={e => {
                  e.preventDefault()
                  subscribe(router.pathname)
                }}
                logo={<UserPlusIcon />}
                label="Upgrade To Pro"
              />
            )}

            <hr
              style={{ margin: "1rem 0" }}
              className="border-t border-gray-200 dark:border-gray-700"
            />

            <NavLink link="/info" logo={<InformationCircleIcon />} label="Info" />
            <NavLink link="/terms/terms" logo={<GlobeAltIcon />} label="Terms and Conditions" />
            <NavLink link="/terms/privacy" logo={<DocumentTextIcon />} label="Privacy Policy" />
            {user && (
              <NavLink link="/support" logo={<ChatBubbleLeftEllipsisIcon />} label="Support" />
            )}
          </ul>
        </nav>
      </header>
      <div className="hidden w-64 sm:block" />

      <main
        className={
          "flex min-h-screen flex-1 flex-col items-center " + (loading ? "opacity-50" : "")
        }
      >
        {children}
      </main>
    </div>
  )
}

const Companies = ({
  companyName,
  otherCompanies,
  router,
}: {
  companyName: string
  otherCompanies?: { companyName: string; id: string }[]
  router: NextRouter
}) => (
  <div className="group/companies relative">
    <button
      type="button"
      className="flex w-full flex-col items-center text-base text-gray-900"
      aria-controls="open-companies-dropdown"
    >
      <div className="group/activecompany relative flex w-full flex-1 flex-nowrap items-center justify-between overflow-hidden rounded-lg p-2 text-left transition duration-75 hover:bg-gray-100 rtl:text-right dark:text-white dark:hover:bg-gray-700">
        <div className="flex flex-shrink flex-row items-center whitespace-nowrap">
          <div className="h-6 w-6 text-gray-500 transition duration-75 group-hover/activecompany:text-gray-900 dark:text-gray-400 dark:group-hover/activecompany:text-white">
            <BuildingOfficeIcon />
          </div>
          <span className="ml-3 flex-1 whitespace-nowrap">{companyName}</span>
        </div>
        <div className="absolute right-0 inline-block bg-gray-50 pl-1 text-gray-500 transition duration-75 group-hover/activecompany:bg-gray-100 dark:bg-gray-800 dark:text-white dark:group-hover/activecompany:bg-gray-700">
          <ChevronDownIcon className=" h-5 w-5" stroke="currentColor" strokeWidth={2} />
        </div>
      </div>
    </button>
    <ul
      id="dropdown-example"
      className="hidden w-full space-y-2 py-2 group-focus-within/companies:block"
    >
      {otherCompanies?.map(({ companyName, id: accountId }) => (
        <li key={accountId}>
          <button
            onClick={async () => {
              const res = await fetchJsonData("/api/switch-company", {
                method: "POST",
                body: { accountId } satisfies DataType,
              })

              if (res.redirect) router.push(res.destination)
              else router.replace(router.asPath)
            }}
            className="group flex w-full items-center rounded-lg p-2 pl-11 text-gray-900 transition duration-75 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
          >
            {companyName}
          </button>
        </li>
      ))}
      <li>
        <button
          className="group flex w-full items-center rounded-lg p-2 text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
          onClick={() => signIn("QBO")}
        >
          <div className="h-6 w-6 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white">
            <PlusSmallIcon />
          </div>
          <span className="ml-3 flex-1 whitespace-nowrap text-left">Add Account</span>
        </button>
      </li>
    </ul>
  </div>
)

type NavInnerProps = {
  logo: JSX.Element
  label: string
  notification?: string
  extra?: string
}

const NavLink = ({
  link,
  ...props
}: {
  link: string
} & NavInnerProps) => (
  <li>
    <Link
      href={link}
      className="group flex items-center rounded-lg p-2 text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
    >
      <NavItemInner {...props} />
    </Link>
  </li>
)
const NavAnchor = ({
  onClick,
  href,
  ...props
}: {
  onClick?: MouseEventHandler<HTMLAnchorElement>
  href: string
} & NavInnerProps) => (
  <li>
    <a
      href={href}
      onClick={onClick}
      className="group flex items-center rounded-lg p-2 text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
    >
      <NavItemInner {...props} />
    </a>
  </li>
)
const NavItemInner = ({ logo, label, notification, extra }: NavInnerProps) => (
  <>
    <div className="h-6 w-6 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white">
      {logo}
    </div>
    <span className="ml-3 flex-1 whitespace-nowrap">{label}</span>
    {notification ? (
      <span className="ml-3 inline-flex h-3 w-3 items-center justify-center rounded-full bg-blue-100 p-3 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300">
        {notification}
      </span>
    ) : null}
    {extra ? (
      <span className="ml-3 inline-flex items-center justify-center rounded-full bg-gray-200 px-2 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
        {extra}
      </span>
    ) : null}
  </>
)
