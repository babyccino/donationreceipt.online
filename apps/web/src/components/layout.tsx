import {
  Bars3BottomLeftIcon,
  ChatBubbleLeftEllipsisIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  PlusCircleIcon,
  RectangleGroupIcon,
  RectangleStackIcon,
  ShoppingBagIcon,
  TableCellsIcon,
  UserCircleIcon,
  UserPlusIcon,
} from "@heroicons/react/24/solid"
import {
  EnterIcon,
  ExitIcon,
  EnvelopeClosedIcon,
  EnvelopeOpenIcon,
  InfoCircledIcon,
} from "@radix-ui/react-icons"
import { Session } from "next-auth"
import { signIn, signOut } from "next-auth/react"
import Link from "next/link"
import { NextRouter, useRouter } from "next/router"
import { MouseEventHandler, ReactNode, useEffect, useState } from "react"

import { DarkModeToggle } from "@/components/dark-mode-toggle"
import { SupportedCountries, getCountryFlag, getCountryName, supportedCountries } from "@/lib/intl"
import { subscribe } from "@/lib/util/request"
import { DataType as SwitchCompanyDataType } from "@/pages/api/switch-company"
import { DataType as SwitchCountryDataType } from "@/pages/api/switch-country"
import { Button } from "components/dist/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "components/dist/ui/select"
import { fetchJsonData } from "utils/dist/request"

export type LayoutProps = {
  session: Session | null
  // id is the account id not the realm id of the associated company
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
  const country = session?.user.country as SupportedCountries | undefined

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
          className="p-4 sm:hidden"
          aria-controls="separator-sidebar"
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
            "bg-card fixed left-0 top-0 z-40 flex h-screen w-64 flex-col justify-between overflow-y-auto px-3 py-4 transition-transform sm:translate-x-0" +
            (showSidebar ? "" : " -translate-x-full")
          }
          aria-label="Sidebar"
        >
          {companies && (
            <Companies
              companyId={session?.accountId as string}
              companies={companies}
              router={router}
            />
          )}
          <ul className="font-medium">
            {user && (
              <>
                <NavItem href="/" highlight={router.asPath === "/"}>
                  <RectangleGroupIcon className="h-4 w-4" />
                  Dashboard
                </NavItem>
                <NavItem href="/items" highlight={router.asPath === "/items"}>
                  <ShoppingBagIcon className="h-4 w-4" />
                  Items
                </NavItem>
                <NavItem href="/details" highlight={router.asPath === "/details"}>
                  <RectangleStackIcon className="h-4 w-4" />
                  Details
                </NavItem>
                <NavItem
                  href="/generate-receipts"
                  highlight={router.asPath === "/generate-receipts"}
                >
                  <TableCellsIcon className="h-4 w-4" />
                  Receipts
                </NavItem>
                <NavItem href="/email" highlight={router.asPath === "/email"}>
                  <EnvelopeClosedIcon className="h-4 w-4" />
                  Email
                </NavItem>
                <NavItem href="/campaign" highlight={router.asPath === "/campaign"}>
                  <EnvelopeOpenIcon className="h-4 w-4" />
                  Campaigns
                </NavItem>
                <NavItem href="/account" highlight={router.asPath === "/account"}>
                  <UserCircleIcon className="h-4 w-4" />
                  Account
                </NavItem>
              </>
            )}

            {user ? (
              <NavItem
                href="/api/auth/signout"
                highlight={router.asPath === "/api/auth/signout"}
                onClick={e => {
                  e.preventDefault()
                  signOut()
                }}
              >
                <ExitIcon className="h-4 w-4" />
                Sign Out
              </NavItem>
            ) : (
              <NavItem
                href={`/auth/signin?callback=${router.asPath}`}
                highlight={router.asPath === "/auth/signin"}
              >
                <EnterIcon className="h-4 w-4" />
                Sign In
              </NavItem>
            )}
            {user && (
              <NavItem
                href="api/stripe/create-checkout-session"
                onClick={e => {
                  e.preventDefault()
                  subscribe(router.pathname)
                }}
              >
                <UserPlusIcon className="h-4 w-4" />
                Upgrade To Pro
              </NavItem>
            )}

            <hr className="mt-5 border-none" />
            <h4 className="text-muted-foreground mb-1 ml-3 text-xs font-light">Legal</h4>
            <NavItem href="/info" highlight={router.asPath === "/info"}>
              <InfoCircledIcon className="h-4 w-4" />
              Info
            </NavItem>
            <NavItem href="/terms/terms" highlight={router.asPath === "/terms/terms"}>
              <GlobeAltIcon className="h-4 w-4" />
              Terms and Conditions
            </NavItem>
            <NavItem href="/terms/privacy" highlight={router.asPath === "/terms/privacy"}>
              <DocumentTextIcon className="h-4 w-4" />
              Privacy Policy
            </NavItem>
            {user && (
              <NavItem href="/support" highlight={router.asPath === "/support"}>
                <ChatBubbleLeftEllipsisIcon className="h-4 w-4" />
                Support
              </NavItem>
            )}
          </ul>
          <div className="mt-auto space-y-2">
            <DarkModeToggle />
            {country && (
              <div className="text-right">
                <SwitchCountry currentCountry={country} router={router} />
              </div>
            )}
          </div>
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

const NavItem = ({
  children,
  href,
  onClick,
  highlight,
}: {
  children: ReactNode
  href: string
  onClick?: MouseEventHandler
  highlight?: boolean
}) => (
  <Button
    className={
      "h-8 w-full justify-start gap-2 px-2 py-0 leading-3" +
      (highlight ? " text-primary hover:text-primary" : " text-foreground/70 font-light")
    }
    variant="ghost"
    asChild
  >
    <Link href={href} onClick={onClick}>
      {children}
    </Link>
  </Button>
)

const SwitchCountry = ({
  currentCountry,
  router,
}: {
  currentCountry: SupportedCountries
  router: NextRouter
}) => (
  <Select defaultValue={currentCountry}>
    <SelectTrigger className="w-auto">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {supportedCountries.map(supportedCountry => (
        <SelectItem
          value={supportedCountry}
          key={supportedCountry}
          onClick={async () => {
            const res = await fetchJsonData("/api/switch-country", {
              method: "POST",
              body: { country: supportedCountry } satisfies SwitchCountryDataType,
            })
            router.replace(router.asPath)
          }}
        >
          <span className="mr-2">
            {getCountryFlag(supportedCountry)} {getCountryName(supportedCountry)}
          </span>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)

const Companies = ({
  companyId,
  companies,
  router,
}: {
  companyId: string
  companies?: { companyName: string; id: string }[]
  router: NextRouter
}) => (
  <Select defaultValue={companyId}>
    <SelectTrigger className="mb-4">
      <SelectValue placeholder="Select Company"></SelectValue>
    </SelectTrigger>
    <SelectContent>
      {companies?.map(({ companyName, id: accountId }) => (
        <SelectItem
          value={accountId}
          key={accountId}
          onClick={async () => {
            const res = await fetchJsonData("/api/switch-company", {
              method: "POST",
              body: { accountId } satisfies SwitchCompanyDataType,
            })

            if (res.redirect) router.push(res.destination)
            else router.replace(router.asPath)
          }}
        >
          {companyName}
        </SelectItem>
      ))}
      <SelectItem value="add-account" onClick={() => signIn("QBO")}>
        <PlusCircleIcon className="-mt-1 mr-2 inline-block h-4 w-4" />
        Add Account
      </SelectItem>
    </SelectContent>
  </Select>
)
