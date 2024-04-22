// svg from heroicons.dev
// hand drawn arrows from svgrepo.com
import { CheckIcon, EnvelopeIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { InputHTMLAttributes, MouseEventHandler, ReactNode, useState } from "react"

import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  CardHeader,
  CardFooter,
} from "components/dist/ui/card"
import { ButtonProps as _ButtonProps, Button, buttonVariants } from "components/dist/ui/button"
import { Spinner } from "components/dist/ui/spinner"
import { SupportedCurrencies, getCurrencySymbol, getPrice } from "@/lib/intl"
import { cn } from "@/lib/utils"

export const MissingData = ({
  filledIn,
}: {
  filledIn: { items: boolean; doneeDetails: boolean }
}) => (
  <div className="mx-auto flex flex-col gap-4 rounded-lg bg-white p-6 pt-5 text-center shadow sm:max-w-md md:mt-8 dark:border dark:border-gray-700 dark:bg-gray-800">
    <span className="col-span-full font-medium text-gray-900 dark:text-white">
      Some information necessary to generate your receipts is missing
    </span>
    <div className="flex justify-evenly gap-3">
      {!filledIn.items && <Link href="/items">Fill in Qualifying Sales Items</Link>}
      {!filledIn.doneeDetails && <Link href="/details">Fill in Donee Details</Link>}
    </div>
  </div>
)

const freeFeatures = ["Individual configuration", "No setup, or hidden fees", "3 free receipts"]
const freeNonFeatures = ["Unlimited receipts", "Automatic emailing"]
const paidFeatures = [
  "Individual configuration",
  "No setup, or hidden fees",
  "Unlimited individual receipt downloads",
  "100 receipt emails included",
  "First class user support",
]
export function PricingCard({
  plan,
  title: propsTitle,
  button,
  currency,
}: {
  plan: "pro" | "free"
  title?: string
  button?: ReactNode
  currency: SupportedCurrencies
}) {
  const isPro = plan === "pro"
  const features = isPro ? paidFeatures : freeFeatures

  const title = propsTitle ?? (isPro ? "Pro Plan" : "Free Plan")

  return (
    <Card className="max-w-96">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-center text-gray-900 dark:text-white">
          {!["usd", "gbp"].includes(currency) && (
            <span className="text-xs font-semibold">{currency.toUpperCase()}</span>
          )}
          <span className="text-5xl font-extrabold tracking-tight">
            {getCurrencySymbol(currency)}
            {isPro ? getPrice(currency) : 0}
          </span>
          <span className="text-md ml-1 font-normal text-gray-500 dark:text-gray-400">/year</span>
        </div>
        <ul className="my-7 space-y-5 text-gray-900 dark:text-white">
          {features.map((feature, idx) => (
            <li key={idx} className="flex space-x-3 text-base font-normal leading-tight">
              <CheckIcon className="-mb-1 mr-4 inline-block w-5 text-green-300" />
              {feature}
            </li>
          ))}
          {!isPro &&
            freeNonFeatures.map((nonFeature, idx) => (
              <li
                key={idx}
                className="flex space-x-3 text-base font-normal leading-tight text-gray-500 line-through decoration-gray-500 dark:text-gray-400"
              >
                <XMarkIcon className="-mb-1 mr-4 inline-block w-5 text-red-300" />
                {nonFeature}
              </li>
            ))}
        </ul>
      </CardContent>
      {button && <CardFooter>{button}</CardFooter>}
    </Card>
  )
}

const LoadingButtonInner = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <div className={`${className} relative cursor-wait`}>
    <div className="absolute left-1/2 -translate-x-1/2">
      <Spinner />
    </div>
    <span className="opacity-0">{children}</span>
  </div>
)

type SubmitProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "children"> & {
  children: string
  loading: boolean
}
export function LoadingSubmitButton({ loading, children, ...props }: SubmitProps) {
  if (loading)
    return (
      <LoadingButtonInner className={cn(buttonVariants({ variant: "outline" }), props.className)}>
        {children}
      </LoadingButtonInner>
    )
  else
    return (
      <input
        {...props}
        className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer", props.className)}
        type="submit"
        value={children}
      />
    )
}

type ButtonProps = _ButtonProps &
  (
    | { loadingImmediately: true }
    | {
        loading: boolean
      }
  )
export function LoadingButton(props: ButtonProps) {
  if ("loadingImmediately" in props && props.loadingImmediately) {
    const { loadingImmediately, ...rest } = props
    return <LoadingButtonImmediately {...rest} />
  } else return <_LoadingButton {...(props as ButtonProps & { loading: boolean })} />
}
export function _LoadingButton({
  loading,
  ...props
}: _ButtonProps & {
  loading: boolean
}) {
  if (loading)
    return <LoadingButtonInner className={props.className}>{props.children}</LoadingButtonInner>
  else return <Button {...props}></Button>
}
function LoadingButtonImmediately(props: _ButtonProps) {
  const [loading, setLoading] = useState(false)

  if (loading)
    return <LoadingButtonInner className={props.className}>{props.children}</LoadingButtonInner>
  return (
    <Button
      {...props}
      onClick={e => {
        setLoading(true)
        props.onClick?.(e)
      }}
      className={props.className}
    />
  )
}
