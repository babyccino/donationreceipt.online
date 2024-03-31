import { signIn } from "next-auth/react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "components/dist/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "components/dist/ui/form"
import { Textarea } from "components/dist/ui/textarea"
import { toast } from "components/dist/ui/use-toast"

import { SignIn } from "@/components/qbo"
import { Checkbox } from "components/dist/ui/checkbox"
import { Spinner } from "components/dist/ui/spinner"
import Link from "next/link"

const schema = z.object({
  agree: z.boolean().refine(value => value === true, {
    message: "You must agree to the terms and conditions",
  }),
})

export default function SignInPage() {
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const callback = searchParams?.get("callback")
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  })

  return (
    <div className="fixed inset-0 flex h-full flex-grow flex-col items-center justify-center gap-8 px-10 align-middle sm:static sm:p-0">
      <div className="flex justify-center gap-4 align-middle">
        <Image src="/android-chrome-192x192.png" alt="logo" width={32} height={32} />
        <h1 className="text-xl font-bold leading-tight tracking-tight text-gray-900 md:text-2xl dark:text-white">
          DonationReceipt.Online
        </h1>
      </div>
      <Form {...form}>
        <form
          className="bg-muted/40 flex w-full max-w-md flex-col items-center rounded-lg p-6 shadow sm:max-w-md sm:p-8 md:mt-0"
          onSubmit={form.handleSubmit(e => {
            setLoading(true)
            signIn("QBO-disconnected", { callbackUrl: "/" + (callback ?? "") })
          })}
        >
          <FormField
            name="agree"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="flex" htmlFor="agree">
                    I agree with the&nbsp;
                    <Link className="!underline" href="/terms/terms">
                      terms and conditions
                    </Link>
                  </FormLabel>
                </div>
                <FormMessage {...field} />
              </FormItem>
            )}
          />
          <button
            type="submit"
            className="relative mx-auto mt-4 inline-block rounded-md bg-[#0077C5]"
          >
            {loading && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <Spinner />
              </div>
            )}
            <span className={loading ? "cursor-wait opacity-0" : ""}>
              <SignIn />
            </span>
          </button>
        </form>
      </Form>
    </div>
  )
}
