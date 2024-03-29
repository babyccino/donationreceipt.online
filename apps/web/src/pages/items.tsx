import { InformationCircleIcon } from "@heroicons/react/24/solid"
import { zodResolver } from "@hookform/resolvers/zod"
import { and, desc, eq } from "drizzle-orm"
import { GetServerSideProps } from "next"
import { getServerSession } from "next-auth"
import dynamic from "next/dynamic"
import { useRouter } from "next/router"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { ApiError } from "utils/dist/error"
import { z } from "zod"

import { LayoutProps } from "@/components/layout"
import { LoadingSubmitButton } from "@/components/ui"
import {
  AccountStatus,
  disconnectedRedirect,
  refreshTokenIfNeeded,
  refreshTokenRedirect,
  signInRedirect,
} from "@/lib/auth/next-auth-helper-server"
import { getItems } from "@/lib/qbo-api"
import { getAccountList, interceptGetServerSidePropsErrors } from "@/lib/util/get-server-side-props"
import { SerialiseDates, deSerialiseDates, serialiseDates } from "@/lib/util/nextjs-helper"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { DataType as ItemsApiDataType } from "@/pages/api/items"
import { Item } from "@/types/qbo-api"
import { Alert } from "components/dist/ui/alert"
import { Button } from "components/dist/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  RenderFunc,
} from "components/dist/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "components/dist/ui/select"
import { Switch } from "components/dist/ui/switch"
import { accounts, db, sessions } from "db"
import {
  DateRange,
  DateRangeType,
  createDateRange,
  endOfPreviousYear,
  endOfThisYear,
  getDateRangeFromType,
  startOfPreviousYear,
  startOfThisYear,
} from "utils/dist/date"
import { fetchJsonData } from "utils/dist/request"

const schema = z.object({
  dateRangeType: z.string({ required_error: "Please select a date range type" }),
  customDateRange: z.object({ startDate: z.date(), endDate: z.date() }).required().optional(),
  items: z.array(z.string()).min(1, { message: "Please select at least one item" }),
})
type Schema = z.infer<typeof schema>

const DumbDatePicker = () => (
  <div className="relative w-full text-gray-700">
    <input
      type="text"
      className="relative w-full rounded-lg border-gray-300 bg-white py-2.5 pl-4 pr-14 text-sm font-light tracking-wide placeholder-gray-400 transition-all duration-300 focus:border-blue-500 focus:ring focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-white/80"
      value="????-??-?? ~ ????-??-??"
      role="presentation"
      disabled
    />
    <button
      type="button"
      className="absolute right-0 h-full px-3 text-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      disabled
    >
      <svg
        className="h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
)
const DatePicker = dynamic(import("react-tailwindcss-datepicker"), {
  loading: props => <DumbDatePicker />,
})

type Props = ({
  items: Item[]
  detailsFilledIn: boolean
} & ({ itemsFilledIn: false } | PropsDateRange)) &
  LayoutProps

type PropsDateRange =
  | {
      itemsFilledIn: true
      selectedItems: string[]
      dateRangeType: NonCustomDateRangeType
    }
  | {
      itemsFilledIn: true
      selectedItems: string[]
      dateRangeType: DateRangeType.Custom
      customDateRange: DateRange
    }

type NonCustomDateRangeType =
  | DateRangeType.AllTime
  | DateRangeType.LastYear
  | DateRangeType.ThisYear
  | DateRangeType.Ytd

type SerialisedProps = SerialiseDates<Props>

type DateValueType = { startDate: Date | string | null; endDate: Date | string | null } | null

const previousYear = new Date().getFullYear() - 1
const defaultDateState = createDateRange(`${previousYear}/01/01`, `${previousYear}/12/31`)

export default function Items(serialisedProps: SerialisedProps) {
  const props = useMemo(() => deSerialiseDates({ ...serialisedProps }), [serialisedProps])
  const { items, detailsFilledIn } = props
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: {
      items: items.map(item => item.id),
      dateRangeType: DateRangeType.LastYear,
      customDateRange: defaultDateState,
    },
  })

  const onSubmit = async (data: Schema) => {
    console.log("form submitted: ", data)

    setLoading(true)

    const postData: ItemsApiDataType = {
      items: data.items,
      dateRange: data.customDateRange ?? getDateRangeFromType(data.dateRangeType as DateRangeType),
    }
    await fetchJsonData("/api/items", { method: "POST", body: postData })

    const destination = detailsFilledIn ? "/generate-receipts" : "/details"
    await router.push({
      pathname: destination,
    })
  }

  const itemsMap = (item: Item) => (
    <FormField
      key={item.id}
      control={form.control}
      name="items"
      render={({ field }) => {
        return (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <FormLabel colorOnError={false}>{item.name}</FormLabel>
              <FormDescription>TODO add descriptions.</FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value?.includes(item.id)}
                onCheckedChange={checked => {
                  return checked
                    ? field.onChange([...field.value, item.id])
                    : field.onChange(field.value?.filter(itemId => itemId !== item.id))
                }}
              />
            </FormControl>
          </FormItem>
        )
      }}
    />
  )

  const dateRangeCb: RenderFunc<Schema, "dateRangeType"> = ({ field }) => (
    <>
      <FormField
        name="dateRangeType"
        control={form.control}
        render={({ field }) => (
          <FormItem className="mb-4">
            <div className="mb-2">
              <FormLabel className="text-base">Date Range</FormLabel>
              <FormDescription>Date range for your receipts.</FormDescription>
            </div>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DateRangeType.LastYear}>Last year</SelectItem>
                <SelectItem value={DateRangeType.ThisYear}>This year</SelectItem>
                <SelectItem value={DateRangeType.Ytd}>This year to date</SelectItem>
                <SelectItem value={DateRangeType.AllTime}>All time</SelectItem>
                <SelectItem value={DateRangeType.Custom}>Custom range</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />
      <FormField
        name="customDateRange"
        control={form.control}
        disabled={field.value !== DateRangeType.Custom}
        render={({ field }) => (
          <FormItem className="mb-8">
            <div className="mb-2">
              {/* <FormLabel>Date Range</FormLabel> */}
              <FormDescription disabled={field.disabled}>
                Specify a custom date range.
              </FormDescription>
            </div>
            <DatePicker
              value={field.value ?? getDateRangeFromType(DateRangeType.LastYear)}
              onChange={(date: DateValueType) => {
                if (!date || !date.endDate || !date.startDate) return
                const startDate =
                  typeof date.startDate == "string" ? new Date(date.startDate) : date.startDate
                const endDate =
                  typeof date.endDate == "string" ? new Date(date.endDate) : date.endDate
                field.onChange({ startDate, endDate })
              }}
              disabled={field.disabled}
            />
            {/* <DumbDatePicker
              value={`${formatDateHtmlReverse(customDateState.startDate)} ~ ${formatDateHtmlReverse(
                customDateState.endDate,
              )}}
            /> */}
          </FormItem>
        )}
      />
    </>
  )

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="m-auto my-4 flex w-full max-w-lg flex-col items-stretch justify-center p-4"
      >
        <Alert className="mb-4">
          <span className="mb-[-0.15rem] mr-2 inline-block h-4 w-4">
            <InformationCircleIcon />
          </span>
          Make sure to only choose your QuickBooks sales items which qualify as donations
        </Alert>
        <FormField
          control={form.control}
          name="items"
          render={({ field }) => (
            <FormItem className="mb-4">
              <div className="mb-4">
                <FormLabel className="text-base">Items</FormLabel>
                <FormDescription colorOnError>
                  Select your quickbooks sales items which qualify as donations.
                </FormDescription>
              </div>
              {items.map(itemsMap)}
              <FormMessage />
              <div className="flex flex-row gap-2 pb-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => field.onChange(items.map(item => item.id))}
                  color="blue"
                >
                  Check All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => field.onChange([])}
                  color="blue"
                >
                  Uncheck All
                </Button>
              </div>
            </FormItem>
          )}
        />
        <FormField name="dateRangeType" control={form.control} render={dateRangeCb} />
        <LoadingSubmitButton loading={loading} color="blue" className="mb-4">
          {detailsFilledIn ? "Generate Receipts" : "Enter Donee Details"}
        </LoadingSubmitButton>
      </form>
    </Form>
  )
}

// --- server-side props --- //

const datesEqual = (date1: Date, date2: Date) => date1.getTime() - date2.getTime() === 0
function getDateRangeType({ startDate, endDate }: DateRange): DateRangeType {
  if (datesEqual(startDate, startOfThisYear()) && datesEqual(endDate, endOfThisYear()))
    return DateRangeType.ThisYear
  if (datesEqual(startDate, startOfPreviousYear()) && datesEqual(endDate, endOfPreviousYear()))
    return DateRangeType.LastYear
  return DateRangeType.Custom
}

const _getServerSideProps: GetServerSideProps<SerialisedProps> = async ({ req, res }) => {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return signInRedirect("items")

  const [account, [accountSwitched, accountList]] = await Promise.all([
    db.query.accounts.findFirst({
      // if the realmId is specified get that account otherwise just get the first account for the user
      where: and(
        eq(accounts.userId, session.user.id),
        session.accountId ? eq(accounts.id, session.accountId) : eq(accounts.scope, "accounting"),
      ),
      columns: {
        id: true,
        accessToken: true,
        scope: true,
        realmId: true,
        createdAt: true,
        expiresAt: true,
        refreshToken: true,
        refreshTokenExpiresAt: true,
      },
      with: {
        userData: { columns: { items: true, startDate: true, endDate: true } },
        doneeInfo: { columns: { id: true } },
      },
      orderBy: desc(accounts.updatedAt),
    }),
    getAccountList(session),
  ])

  // this shouldn't really happen as the user should have been automatically signed into one of their connected accounts
  if (accountSwitched) {
    return { redirect: { destination: "/items", permanent: false } }
  }

  if (session.accountId && !account)
    throw new ApiError(500, "account for given user and session not found in db")

  // if the session does not specify an account but there is a connected account
  // then the session is connected to one of these accounts
  if (!session.accountId && account) {
    session.accountId = account.id
    await db
      .update(sessions)
      .set({ accountId: account.id })
      .where(eq(sessions.userId, session.user.id))
  }

  if (
    !account ||
    account.scope !== "accounting" ||
    !account.accessToken ||
    !account.realmId ||
    !session.accountId
  )
    return disconnectedRedirect("items")

  const { currentAccountStatus } = await refreshTokenIfNeeded(account)
  if (currentAccountStatus === AccountStatus.RefreshExpired) {
    return refreshTokenRedirect("items")
  }
  const realmId = account.realmId
  const items = await getItems(account.accessToken, realmId)
  const detailsFilledIn = Boolean(account.doneeInfo)

  if (!account.userData) {
    return {
      props: {
        itemsFilledIn: false,
        session,
        items,
        detailsFilledIn,
        companies: accountList,
        selectedAccountId: session.accountId,
      } satisfies Props,
    }
  }

  const { userData } = account
  const selectedItems = userData.items ? userData.items.split(",") : []
  const dateRangeType = getDateRangeType(userData)
  if (dateRangeType !== DateRangeType.Custom)
    return {
      props: serialiseDates({
        itemsFilledIn: true,
        session,
        items,
        detailsFilledIn,
        selectedItems,
        companies: accountList,
        selectedAccountId: session.accountId,
        dateRangeType,
      } satisfies Props),
    }

  return {
    props: serialiseDates({
      itemsFilledIn: true,
      session,
      items,
      detailsFilledIn,
      selectedItems,
      companies: accountList,
      selectedAccountId: session.accountId,
      dateRangeType,
      customDateRange: { startDate: userData.startDate, endDate: userData.endDate },
    } satisfies Props),
  }
}

export const getServerSideProps = interceptGetServerSidePropsErrors(_getServerSideProps)
