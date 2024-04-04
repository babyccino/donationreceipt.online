import { InfoCircledIcon } from "@radix-ui/react-icons"
import { zodResolver } from "@hookform/resolvers/zod"
import makeChecksum from "checksum"
import { and, desc, eq, gt, inArray, lt } from "drizzle-orm"
import { GetServerSideProps } from "next"
import { getServerSession } from "next-auth"
import { useRouter } from "next/router"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import z from "zod"

import { LayoutProps } from "@/components/layout"
import { LoadingButton, MissingData } from "@/components/ui"
import { dummyEmailProps } from "@/emails/props"
import {
  AccountStatus as AuthAccountStatus,
  disconnectedRedirect,
  refreshTokenIfNeeded,
  refreshTokenRedirect,
  signInRedirect,
} from "@/lib/auth/next-auth-helper-server"
import { defaultEmailBody, formatEmailBody, templateDonorName, trimHistoryById } from "@/lib/email"
import { getDonations } from "@/lib/qbo-api"
import { isUserSubscribed } from "@/lib/stripe"
import { getAccountList, interceptGetServerSidePropsErrors } from "@/lib/util/get-server-side-props"
import { SerialiseDates, deSerialiseDates, dynamic, serialiseDates } from "@/lib/util/nextjs-helper"
import { regularCharacterRegex } from "@/lib/util/regex"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { EmailDataType } from "@/pages/api/email"
import { EmailProps } from "components/dist/receipt/types"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "components/dist/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "components/dist/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "components/dist/ui/alert-dialog"
import { Button } from "components/dist/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "components/dist/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "components/dist/ui/form"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "components/dist/ui/pagination"
import { RadioGroup, RadioGroupItem } from "components/dist/ui/radio-group"
import { Switch } from "components/dist/ui/switch"
import { Textarea } from "components/dist/ui/textarea"
import { ToastAction, useToast } from "components/dist/ui/toast"
import {
  Campaign as DbCampaigns,
  Receipt as DbReceipts,
  accounts,
  campaigns,
  db,
  receipts,
  sessions,
  users,
} from "db"
import { storageBucket } from "db/dist/firebase"
import { formatDateHtml } from "utils/dist/date"
import { downloadImagesForDonee } from "utils/dist/db-helper"
import { ApiError } from "utils/dist/error"
import { fetchJsonData } from "utils/dist/request"

const WithBody = dynamic(() => import("components/dist/receipt/email").then(mod => mod.WithBody), {
  loading: () => null,
  ssr: false,
  loadImmediately: true,
})

type DoneeInfo = EmailProps["donee"]
type Campaign = Pick<DbCampaigns, "createdAt" | "startDate" | "endDate"> & {
  receipts: Pick<DbReceipts, "name" | "donorId">[]
}
enum AccountStatus {
  NotSubscribed = 0,
  IncompleteData,
  Complete,
}
enum RecipientStatus {
  Valid = 0,
  NoEmail,
}
type Recipient = { name: string; donorId: string } & (
  | { status: RecipientStatus.NoEmail; email: null }
  | { status: RecipientStatus.Valid; email: string }
)

const CampaignOverlap = ({ campaigns }: { campaigns: Campaign[] }) => (
  <div>
    <h3 className="mb-4 font-medium">Campaign Overlap</h3>
    <Alert className="mb-4" variant="warning">
      <InfoCircledIcon className="mr-2 mt-[0.35rem] inline-block h-4 w-4" />
      <AlertTitle>Overlap Detected!</AlertTitle>
      <AlertDescription>
        Your selection of donees and date range overlaps with previous campaigns
      </AlertDescription>
    </Alert>
    <p className="text-muted-foreground text-sm leading-relaxed">
      Please verify you are not receipting the same donations twice. The following previous
      campaigns have overlap with the current campaign:
    </p>
    <Accordion type="multiple" className="w-full">
      {campaigns.map((entry, index) => {
        const campaignDate = formatDateHtml(entry.createdAt)
        return (
          <AccordionItem key={index} value={index.toString()}>
            <AccordionTrigger>{campaignDate}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground mb-2">
              <p>
                You sent a campaign on <i>{campaignDate}</i> which spanned donations from{" "}
                <i>{formatDateHtml(entry.startDate)}</i> to <i>{formatDateHtml(entry.endDate)}</i>
              </p>
              These donors will be sent receipts which overlap with the current campaign:
              <br />
              <ul className="mt-1 list-inside list-disc">
                {entry.receipts.map(receipt => (
                  <li key={receipt.name}>{receipt.name}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  </div>
)

function getErrorText(error: ApiError) {
  switch (error.statusCode) {
    case 400:
      switch (error.message) {
        case "checksum mismatch":
          return "There has been a change to your accounting data. Please review your receipts again before sending."
        case "data missing":
          return "Data is unexpectedly missing from your account. Please reload the page and try again. \
                  If this continues please contact an administrator."
        default:
          return "There was an unexpected client error. If this continues please contact an administrator. \
                  If this continues please contact an administrator."
      }
    case 401:
      switch (error.message) {
        case "not subscribed":
          return "There was error with your subscription. Please reload the page and try again. \
                  If this continues please contact an administrator."
        default:
          return "There was an unexpected error with your authentication. If this continues please contact an administrator."
      }
    case 429:
      return "You are only allowed 5 email campaigns within a 24 hour period on your current plan."
    case 500:
    default:
      throw error
  }
}

const schema = z.object({
  emailBody: z
    .string({ required_error: "This field is required." })
    .regex(regularCharacterRegex, {
      message:
        "This field can contain alphanumeric characters and the following special characters: -_,'&@#:()[]",
    })
    .min(1),
  customRecipients: z.boolean(),
  recipients: z.array(z.string()).min(1, { message: "Please select at least one recipient." }),
})
type Schema = z.infer<typeof schema>
type FormType = ReturnType<typeof useForm<Schema>>

function subArrays<T>(arr: T[], size: number): T[][] {
  return arr.reduce<T[][]>((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), [])
}
function SelectRecipients({ allRecipients, form }: { allRecipients: Recipient[]; form: FormType }) {
  const itemsMap = (recipient: Recipient) => (
    <FormField
      key={recipient.donorId}
      control={form.control}
      name="recipients"
      render={({ field }) => {
        return (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <FormLabel
                colorOnError={false}
                className={recipient.status === RecipientStatus.NoEmail ? "text-muted" : ""}
              >
                {recipient.name}
              </FormLabel>
              <FormDescription
                colorOnError={false}
                className={recipient.status === RecipientStatus.NoEmail ? "text-muted" : ""}
              >
                {recipient.status === RecipientStatus.NoEmail ? "No email" : recipient.email}
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value?.includes(recipient.donorId)}
                disabled={recipient.status === RecipientStatus.NoEmail}
                onCheckedChange={checked => {
                  return checked
                    ? field.onChange([...field.value, recipient.donorId])
                    : field.onChange(field.value?.filter(itemId => itemId !== recipient.donorId))
                }}
              />
            </FormControl>
          </FormItem>
        )
      }}
    />
  )

  const customRecipients = form.watch("customRecipients")

  const PaginatedRecipients = () => {
    const [page, setPage] = useState(1)
    const perPage = 12

    const previousPage = () => {
      if (page > 1) setPage(page => page - 1)
    }
    const nextPage = () => {
      if (page < Math.ceil(allRecipients.length / perPage)) setPage(page => page + 1)
    }

    return (
      <div className="space-y-2">
        <div>
          {subArrays(allRecipients, perPage).map((recipients, index) => (
            <div
              key={index}
              className={"grid-cols-2 gap-2 sm:grid " + (page === index + 1 ? "" : "!hidden")}
            >
              {recipients.map(recipient => itemsMap(recipient))}
            </div>
          ))}
        </div>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                type="button"
                disabled={customRecipients && page === 1}
                as="button"
                onClick={previousPage}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink type="button" as="button" isActive>
                {page}
              </PaginationLink>
            </PaginationItem>
            {/* <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem> */}
            <PaginationItem>
              <PaginationNext
                disabled={customRecipients && page === Math.ceil(allRecipients.length / perPage)}
                type="button"
                as="button"
                onClick={nextPage}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    )
  }

  const missingEmails = allRecipients.some(
    recipient => recipient.status === RecipientStatus.NoEmail,
  )
  return (
    <div>
      <h3 className="mb-2 font-medium">Recipients</h3>
      {missingEmails && <RecipientsMissingEmails allRecipients={allRecipients} />}
      <p className="text-muted-foreground mb-3 text-[0.8rem] transition-colors">
        If you wish to select your recipients manually please select {'"'}Manually select recipients
        {'"'}. Otherwise, all possible donors will be selected.
      </p>
      <FormField
        control={form.control}
        name="customRecipients"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormControl>
              <RadioGroup
                onValueChange={e => {
                  const customRecipients = e === "select"
                  if (!customRecipients) form.resetField("recipients")
                  field.onChange(customRecipients)
                }}
                defaultValue={field.value ? "select" : "all"}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-3 space-y-0">
                  <RadioGroupItem value="all" id="all" />
                  <FormLabel htmlFor="all" className="font-normal">
                    All recipients
                  </FormLabel>
                </div>
                <div className="flex items-center space-x-3 space-y-0">
                  <RadioGroupItem value="select" id="select" />
                  <FormLabel htmlFor="select" className="font-normal">
                    Manually select recipients
                  </FormLabel>
                </div>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="recipients"
        render={() => (
          <FormItem
            className={"relative pt-4 transition-opacity " + (customRecipients ? "" : "opacity-30")}
          >
            {allRecipients.length <= 12 ? (
              <div className="grid-cols-2 gap-2 sm:grid">{allRecipients.map(itemsMap)}</div>
            ) : (
              <PaginatedRecipients />
            )}
            <FormMessage />
            {/* // TODO maybe implement?
                <div className="flex flex-row gap-2 pb-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => field.onChange(items.map(item => item.id))}
                  color="blue"
                >
                  Check All
                </Button>
                <Button type="button" variant="outline" onClick={() => field.onChange([])} color="blue">
                  Uncheck All
                </Button>
              </div> */}
            {!customRecipients && <div className="absolute inset-0 z-10"></div>}
          </FormItem>
        )}
      />
    </div>
  )
}

const RecipientsMissingEmails = ({ allRecipients }: { allRecipients: Recipient[] }) => {
  return (
    <div className="mb-2 rounded-lg border p-4 pb-2">
      <div className="mb-1 mt-1 flex items-center">
        <InfoCircledIcon className="-mt-1 mb-1 mr-2 inline-block h-4 w-4" />
        <h3 className="mb-2 text-sm font-medium leading-none tracking-tight">
          Recipients missing emails
        </h3>
      </div>
      <p className="text-sm leading-relaxed">
        Some of your clients who would be included in this campaign are missing emails. Please add
        emails to these clients on QuickBooks if you wish to send receipts to all your clients.
      </p>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1" className="border-b-0">
          <AccordionTrigger>Users missing emails:</AccordionTrigger>
          <AccordionContent>
            <ul className="mx-4 max-w-md list-inside list-none space-y-1 text-left text-xs text-gray-500 sm:columns-2 dark:text-gray-400">
              {allRecipients
                .filter(recipient => recipient.status === RecipientStatus.NoEmail)
                .map(recipient => (
                  <li className="truncate" key={recipient.donorId}>
                    {recipient.name}
                  </li>
                ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

// --- page --- //

type CompleteAccountProps = {
  accountStatus: AccountStatus.Complete
  donee: DoneeInfo
  allRecipients: Recipient[]
  campaign: Campaign[] | null
  checksum: string
}

function CompleteAccountEmail({ donee, allRecipients, campaign, checksum }: CompleteAccountProps) {
  const recipientsWithEmails = useMemo(
    () =>
      allRecipients
        .filter(recipient => recipient.status === RecipientStatus.Valid)
        .map(({ donorId }) => donorId),
    [allRecipients],
  )
  const [showDialog, setShowDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: {
      recipients: recipientsWithEmails,
      customRecipients: false,
      emailBody: defaultEmailBody,
    },
  })
  const { watch } = form
  const { toast } = useToast()
  const router = useRouter()

  const onSubmit = async (data: Schema) => {
    console.log({ data })
    setShowDialog(true)
  }

  const sendEmail = async () => {
    console.log("send email")
    const data = form.getValues()
    setLoading(true)

    const req: EmailDataType = {
      emailBody: data.emailBody,
      checksum,
    }
    if (data.customRecipients) {
      req.recipientIds = data.recipients
    }

    try {
      const res = await fetchJsonData("/api/email", {
        method: "POST",
        body: req,
      })
      if (res.campaignId) return router.push(`/campaign/${res.campaignId}`)
      toast({ description: "Your message has been sent" })
      setLoading(false)
    } catch (error) {
      setLoading(false)
      console.error(error)
      if (!(error instanceof ApiError)) throw error
      if (error.message.startsWith("checksum"))
        return toast({
          variant: "destructive",
          description:
            "Your QuickBooks data has changed since you last loaded this page. Please reload the page and try again.",
          action: (
            <ToastAction altText="Reload page" onClick={() => router.replace(router.asPath)}>
              Reload
            </ToastAction>
          ),
        })
      const errText = getErrorText(error)
      toast({ variant: "destructive", description: errText })
    }
  }

  const trimmedHistory = campaign
    ? trimHistoryById(new Set(watch().recipients), campaign)
    : campaign

  return (
    <section className="gap- 4flex-col flex w-full max-w-3xl justify-center p-8 pb-12 pt-4 align-middle sm:pt-12">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="emailBody"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="mb-2 inline-block text-base" htmlFor="body">
                  Your email template
                </FormLabel>
                <FormControl>
                  <Textarea className="min-h-56" placeholder="Type your message here." {...field} />
                </FormControl>
                <FormDescription>
                  Use <code>{templateDonorName}</code> to reference your donor{"'"}s name
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Dialog onOpenChange={state => setPreviewOpen(state)}>
            <DialogTrigger asChild>
              <Button variant="outline">Show preview</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[95vh] w-full max-w-5xl overflow-auto p-0 pt-12 text-gray-50">
              <div className="h-full">
                {previewOpen && (
                  <WithBody
                    {...dummyEmailProps}
                    donee={{ ...dummyEmailProps.donee, ...donee }}
                    body={formatEmailBody(watch().emailBody, dummyEmailProps.donation.name)}
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
          {<SelectRecipients allRecipients={allRecipients} form={form} />}
          {trimmedHistory && <CampaignOverlap campaigns={trimmedHistory} />}
          <Button type="submit" className="w-full">
            Send receipts
          </Button>
          <AlertDialog open={showDialog}>
            {/* <AlertDialogTrigger asChild></AlertDialogTrigger> */}
            <AlertDialogContent className="max-w-xl space-y-4 text-center">
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you{"'"}re ready to send?</AlertDialogTitle>
                <AlertDialogDescription className="font-normal text-gray-500 dark:text-gray-400">
                  Please ensure that you confirm the accuracy of your receipts on the {'"'}
                  Receipts
                  {'"'} page prior to sending. <br />
                  <br />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex justify-center gap-4">
                <AlertDialogAction asChild>
                  <LoadingButton loading={loading} variant="destructive" onClick={sendEmail}>
                    Yes, I{"'"}m sure
                  </LoadingButton>
                </AlertDialogAction>
                <AlertDialogCancel onClick={() => setShowDialog(false)}>
                  No, cancel
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </form>
      </Form>
    </section>
  )
}

type IncompleteAccountProps = {
  accountStatus: AccountStatus.IncompleteData
  filledIn: { items: boolean; doneeDetails: boolean }
  companyName?: string
}
type Props = (IncompleteAccountProps | CompleteAccountProps) & LayoutProps
type SerialisedProps = SerialiseDates<Props>
export default function Email(serialisedProps: SerialisedProps) {
  const props = useMemo(() => deSerialiseDates({ ...serialisedProps }), [serialisedProps])
  if (props.accountStatus === AccountStatus.IncompleteData)
    return (
      <section className="flex h-full flex-col justify-center gap-4 p-8 align-middle">
        <MissingData filledIn={props.filledIn} />
      </section>
    )
  else return <CompleteAccountEmail {...props} />
}

// --- server side props --- //

const _getServerSideProps: GetServerSideProps<SerialisedProps> = async ({ req, res }) => {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return signInRedirect("email")

  const [user, [accountSwitched, accountList]] = await Promise.all([
    db.query.users.findFirst({
      // if the realmId is specified get that account otherwise just get the first account for the user
      where: eq(users.id, session.user.id),
      columns: { name: true },
      with: {
        accounts: {
          where: session.accountId
            ? eq(accounts.id, session.accountId)
            : eq(accounts.scope, "accounting"),
          orderBy: desc(accounts.updatedAt),
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
            doneeInfo: {
              columns: { accountId: false, createdAt: false, id: false, updatedAt: false },
            },
            userData: { columns: { items: true, startDate: true, endDate: true } },
          },
        },
        billingAddress: { columns: { name: true } },
        subscription: {
          columns: {
            cancelAtPeriodEnd: true,
            status: true,
            createdAt: true,
            currentPeriodEnd: true,
          },
        },
      },
    }),
    getAccountList(session),
  ])

  // this shouldn't really happen as the user should have been automatically signed into one of their connected accounts
  if (accountSwitched) {
    return { redirect: { destination: "/email", permanent: false } }
  }

  if (!user) throw new ApiError(500, "user not found in db")
  let account = user.accounts?.[0] as (typeof user.accounts)[number] | undefined
  if (session.accountId && !account)
    throw new ApiError(500, "account for given user and session not found in db")

  if (!account || account.scope !== "accounting" || !account.accessToken)
    return disconnectedRedirect("email")

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
    return disconnectedRedirect("email")

  if (!user.subscription || !isUserSubscribed(user.subscription))
    return { redirect: { permanent: false, destination: "subscribe" } }

  const { doneeInfo, userData } = account
  if (!doneeInfo || !userData) {
    const props: Props = {
      accountStatus: AccountStatus.IncompleteData,
      filledIn: { doneeDetails: Boolean(doneeInfo), items: Boolean(userData) },
      session,
      companies: accountList,
      selectedAccountId: account.id,
    }
    if (doneeInfo) props.companyName = doneeInfo.companyName
    return { props: serialiseDates(props) }
  }

  const { currentAccountStatus } = await refreshTokenIfNeeded(account)
  if (currentAccountStatus === AuthAccountStatus.RefreshExpired) {
    return refreshTokenRedirect("email")
  }

  const donations = await getDonations(
    account.accessToken,
    account.realmId,
    { startDate: userData.startDate, endDate: userData.endDate },
    userData.items ? userData.items.split(",") : [],
  )
  const allRecipients = donations.map(({ donorId, name, email }) => ({
    donorId,
    name,
    email,
    status: email ? RecipientStatus.Valid : RecipientStatus.NoEmail,
  })) as Recipient[]
  const recipientIds = allRecipients.map(({ donorId }) => donorId)

  const dateOverlap = and(
    lt(campaigns.startDate, userData.endDate),
    gt(campaigns.endDate, userData.startDate),
    eq(campaigns.accountId, account.id),
  )
  const campaign = (
    await db.query.campaigns.findMany({
      columns: {
        createdAt: true,
        startDate: true,
        endDate: true,
      },
      where: dateOverlap,
      with: {
        receipts: {
          columns: { name: true, donorId: true },
          where: inArray(receipts.donorId, recipientIds),
        },
      },
    })
  ).filter(item => item.receipts.length > 0)

  return {
    props: serialiseDates({
      accountStatus: AccountStatus.Complete,
      donee: await downloadImagesForDonee(doneeInfo, storageBucket),
      allRecipients,
      checksum: makeChecksum(JSON.stringify(donations)),
      session,
      companies: accountList,
      selectedAccountId: account.id,
      campaign: campaign.length > 0 ? campaign : null,
    } satisfies Props),
  }
}
export const getServerSideProps = interceptGetServerSidePropsErrors(_getServerSideProps)
