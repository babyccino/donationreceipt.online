import { zodResolver } from "@hookform/resolvers/zod"
import { FormEventHandler, useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { LoadingSubmitButton } from "@/components/ui"
import {
  htmlRegularCharactersRegexString,
  regularCharacterHelperText,
  regularCharacterRegex,
} from "@/lib/util/regex"
import { DataType as ContactDataType } from "@/pages/api/support"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "components/dist/ui/form"
import { useToast } from "components/dist/ui/use-toast"
import { fetchJsonData } from "utils/dist/request"
import { Input } from "components/dist/ui/input"
import { Textarea } from "components/dist/ui/textarea"

const schema = z.object({
  from: z.string({ required_error: "This field is required." }).email(),
  subject: z
    .string({ required_error: "This field is required." })
    .regex(regularCharacterRegex)
    .min(1),
  body: z.string({ required_error: "This field is required." }).regex(regularCharacterRegex).min(1),
})
type Schema = z.infer<typeof schema>

export default function Support() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Schema) => {
    if (loading) return
    setLoading(true)
    try {
      const apiResponse = await fetchJsonData("/api/support", {
        method: "POST",
        body: data satisfies ContactDataType,
      })
      toast({ description: "Message sent successfully." })
    } catch (e) {
      toast({
        variant: "desctructive",
        title: "Uh oh! Something went wrong.",
        description: "An error occurred while sending the message.",
      })
    }
    setLoading(false)
  }

  return (
    <section className="flex w-full justify-center p-4 sm:min-h-screen sm:items-center">
      <div className="w-full max-w-xl">
        <div className="mb-6 space-y-2">
          <h1 className="text-3xl font-bold">Contact Support</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Please fill out the form below to open a support ticket.
          </p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-4">
            <FormField
              control={form.control}
              name="from"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="mb-2 inline-block" htmlFor="from">
                    Your email address
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="john.smith@gmail.com" type="email" {...field} />
                  </FormControl>
                  {/* <FormDescription></FormDescription> */}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="mb-2 inline-block" htmlFor="subject">
                    The subject of your support request
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your summary here." {...field} />
                  </FormControl>
                  <FormDescription>Give a summary of the issue you{"'"}re facing.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="mb-2 inline-block" htmlFor="body">
                    Message
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-32"
                      placeholder="Type your message here."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    We welcome any and all feedback! If you are having an issue please be detailed
                    as possible in your description.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <LoadingSubmitButton loading={loading}>Send message</LoadingSubmitButton>
          </form>
        </Form>
      </div>
    </section>
  )
}

// --- server-side props ---

export { defaultGetServerSideProps as getServerSideProps } from "@/lib/util/get-server-side-props"
