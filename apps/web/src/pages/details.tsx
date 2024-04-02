import { zodResolver } from "@hookform/resolvers/zod"
import { desc, eq } from "drizzle-orm"
import { GetServerSideProps } from "next"
import { Session, getServerSession } from "next-auth"
import { useRouter } from "next/router"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
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
import { getCompanyInfo } from "@/lib/qbo-api"
import { getAccountList, interceptGetServerSidePropsErrors } from "@/lib/util/get-server-side-props"
import { charityRegistrationNumberRegexString, regularCharacterRegex } from "@/lib/util/regex"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import { DataType as DetailsApiDataType } from "@/pages/api/details"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "components/dist/ui/form"
import { FileInput, Input } from "components/dist/ui/input"
import { DoneeInfo, accounts, db, sessions } from "db"
import { RemoveTimestamps } from "utils/dist/db-helper"
import { ApiError } from "utils/dist/error"
import { base64DataUrlEncodeFile, supportedExtensions } from "utils/dist/image-helper"
import { fetchJsonData } from "utils/dist/request"

type PDoneeInfo = Partial<Omit<RemoveTimestamps<DoneeInfo>, "id" | "userId">>

type Props = {
  doneeInfo: PDoneeInfo
  session: Session
  itemsFilledIn: boolean
} & LayoutProps

const MAX_FILE_SIZE = 102400
const fileSizeRefiner = (file: File | undefined) => {
  if (!file) return true
  return file.size < MAX_FILE_SIZE
}
const extensionRefiner = (file: File | undefined) => {
  if (!file) return true
  const extension = file.name.split(".").pop()
  console.log({ extension })
  return extension !== undefined && supportedExtensions.includes(extension)
}
const fileOptionalSchema = z
  .any()
  .optional()
  .refine(extensionRefiner, { message: "File must be a PNG, JPG, WebP or GIF" })
  .refine(fileSizeRefiner, { message: "File must be less than 100kb" })
const fileRequiredSchema = z
  .any({ required_error: "This field is required." })
  .refine(extensionRefiner, { message: "File must be a PNG, JPG, WebP or GIF" })
  .refine(fileSizeRefiner, { message: "File must be less than 100kb" })
const zodRegularString = z
  .string({ required_error: "This field is required." })
  .regex(regularCharacterRegex, {
    message:
      "This field can contain alphanumeric characters and the following special characters: -_,'&@#:()[]",
  })

function assertFile(file: any): asserts file is File | undefined {
  if (file && !(file instanceof File)) throw new Error("File must be a file class instance")
}

export default function Details({ doneeInfo, itemsFilledIn, session }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const schema = useMemo(
    () =>
      z.object({
        companyName: zodRegularString,
        companyAddress: zodRegularString.min(10, { message: "Must be at least 10 characters" }),
        country: zodRegularString.min(2, { message: "Must be at least 2 characters" }),
        registrationNumber: z
          .string({ required_error: "This field is required." })
          .regex(new RegExp(charityRegistrationNumberRegexString), {
            message: "Canadian registration numbers are of the format: 123456789AA1234",
          }),
        signatoryName: zodRegularString.min(5, { message: "Must be at least 5 characters" }),
        signature: doneeInfo.signature ? fileOptionalSchema : fileRequiredSchema,
        smallLogo: doneeInfo.smallLogo ? fileOptionalSchema : fileRequiredSchema,
      }),
    [doneeInfo],
  )
  type Schema = z.infer<typeof schema>
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyAddress: doneeInfo.companyAddress,
      companyName: doneeInfo.companyName,
      country: doneeInfo.country,
      registrationNumber: doneeInfo.registrationNumber ?? undefined,
      signatoryName: doneeInfo.signatoryName ?? undefined,
    },
  })

  const onSubmit = async (data: Schema) => {
    setLoading(true)
    const { signature, smallLogo } = data
    assertFile(signature)
    assertFile(smallLogo)
    const signatureDataUrl = signature ? await base64DataUrlEncodeFile(signature) : undefined
    const smallLogoDataUrl = smallLogo ? await base64DataUrlEncodeFile(smallLogo) : undefined

    await fetchJsonData("/api/details", {
      method: "POST",
      body: {
        ...data,
        signature: signatureDataUrl,
        smallLogo: smallLogoDataUrl,
      } satisfies DetailsApiDataType,
    })

    const destination = itemsFilledIn ? "/generate-receipts" : "/items"
    await router.push({
      pathname: destination,
    })
    console.log("submit")
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="m-auto my-4 flex w-full max-w-lg flex-col items-stretch justify-center space-y-2 p-4"
      >
        {/* <Legend className="sm:col-span-2">Organisation</Legend> */}
        {/* TODO use text area + multi-line strings? */}
        <FormField
          control={form.control}
          name="companyAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>The legal address of your company/organisation.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Legal name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>The full name of your organisation.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>The country your company is based in.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="registrationNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Charity registration number</FormLabel>
              <FormControl>
                <Input placeholder="123456789RR0001" {...field} />
              </FormControl>
              <FormDescription>
                Depending on the tax legislation in your country, this may be required.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="signatoryName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Signatory{"'"}s name</FormLabel>
              <FormControl>
                <Input placeholder={session.user.name} {...field} />
              </FormControl>
              <FormDescription>The name of your designated signatory.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="signature"
          render={({ field }) => (
            <FormItem className="pt-4">
              <FormLabel>Image of signatory{"'"}s signature</FormLabel>
              <FormControl>
                <FileInput
                  {...field}
                  value={field.value?.fileName}
                  onChange={event => {
                    field.onChange(event.target.files?.[0])
                  }}
                  type="file"
                />
              </FormControl>
              <FormDescription>
                An image of your designated signatory{"'"}s signature. Must be in jpeg, png, webp,
                gif format and less than {Math.floor(MAX_FILE_SIZE / 1024)}.{" "}
                {doneeInfo.signature && "Choose a file to replace the existing one."}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="smallLogo"
          render={({ field }) => (
            <FormItem className="pb-4">
              <FormLabel>Small image of organisation{"'"}s logo</FormLabel>
              <FormControl>
                <FileInput
                  {...field}
                  value={field.value?.fileName}
                  onChange={event => {
                    field.onChange(event.target.files?.[0])
                  }}
                  type="file"
                />
              </FormControl>
              <FormDescription>
                An image of your designated signatory{"'"}s signature. Must be in jpeg, png, webp,
                gif format and less than {Math.floor(MAX_FILE_SIZE / 1024)}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <LoadingSubmitButton loading={loading}>
          {itemsFilledIn ? "Generate Receipts" : "Select Qualifying Items"}
        </LoadingSubmitButton>
      </form>
    </Form>
  )
}

// --- server-side props --- //

const _getServerSideProps: GetServerSideProps<Props> = async ({ req, res }) => {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return signInRedirect("details")

  const [account, [accountSwitched, accountList]] = await Promise.all([
    db.query.accounts.findFirst({
      // if the realmId is specified get that account otherwise just get the first account for the user
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
        userData: { columns: { id: true } },
        doneeInfo: {
          columns: {
            companyAddress: true,
            companyName: true,
            country: true,
            registrationNumber: true,
            signatoryName: true,
            smallLogo: true,
          },
        },
      },
    }),
    getAccountList(session),
  ])

  if (accountSwitched) {
    return { redirect: { destination: "/details", permanent: false } }
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
    return disconnectedRedirect("details")

  const { currentAccountStatus } = await refreshTokenIfNeeded(account)
  if (currentAccountStatus === AccountStatus.RefreshExpired) {
    return refreshTokenRedirect("details")
  }
  const realmId = account.realmId
  const itemsFilledIn = Boolean(account.userData)

  const doneeInfo = account.doneeInfo
    ? account.doneeInfo
    : await getCompanyInfo(account.accessToken, realmId)

  return {
    props: {
      session,
      doneeInfo,
      itemsFilledIn,
      companies: accountList,
      selectedAccountId: session.accountId,
    } satisfies Props,
  }
}
export const getServerSideProps = interceptGetServerSidePropsErrors(_getServerSideProps)
