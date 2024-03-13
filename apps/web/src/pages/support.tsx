import { Label, TextInput, Textarea } from "flowbite-react"
import { FormEventHandler, useRef, useState } from "react"

import { EmailSentToast, LoadingSubmitButton } from "@/components/ui"
import { htmlRegularCharactersRegexString, regularCharacterHelperText } from "@/lib/util/regex"
import { DataType as ContactDataType } from "@/pages/api/support"
import { fetchJsonData } from "utils/dist/request"

export default function Support() {
  const formRef = useRef<HTMLFormElement>(null)
  const [showEmailSentToast, setShowEmailSentToast] = useState(false)
  const [loading, setLoading] = useState(false)

  function getFormData() {
    if (!formRef.current) throw new Error("Form html element has not yet been initialised")

    const formData = new FormData(formRef.current)

    const from = formData.get("from") as string
    const subject = formData.get("subject") as string
    const body = formData.get("body") as string

    return {
      from,
      subject,
      body,
    }
  }

  const onSubmit: FormEventHandler<HTMLFormElement> = async event => {
    if (loading) return
    setLoading(true)
    event.preventDefault()
    const formData: ContactDataType = getFormData()
    const apiResponse = await fetchJsonData("/api/support", { method: "POST", body: formData })
    setLoading(false)
    setShowEmailSentToast(true)
  }

  return (
    <section>
      <div className="mx-auto max-w-screen-md px-4 py-8 lg:py-16">
        <h2 className="mb-4 text-center text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Contact Us
        </h2>
        <p className="mb-8 text-center font-light text-gray-500 sm:text-xl lg:mb-16 dark:text-gray-400">
          Got a technical issue? Want to send feedback? Let us know.
        </p>
        <form ref={formRef} onSubmit={onSubmit} className="space-y-8">
          <p>
            <Label className="mb-2 inline-block" htmlFor="from">
              Your email
            </Label>
            <TextInput
              name="from"
              id="from"
              type="email"
              minLength={5}
              placeholder="name@email.com"
              required
            />
          </p>
          <p>
            <Label className="mb-2 inline-block" htmlFor="subject">
              Subject
            </Label>
            <TextInput
              name="subject"
              id="subject"
              pattern={htmlRegularCharactersRegexString}
              minLength={5}
              title={regularCharacterHelperText}
              placeholder="Let us know how we can help you"
            />
          </p>
          <p>
            <Label className="mb-2 inline-block" htmlFor="body">
              Please describe the issue you{"'"}re having
            </Label>
            <Textarea
              name="body"
              id="body"
              minLength={5}
              rows={6}
              placeholder="How can we help you?..."
              required
            />
          </p>
          <LoadingSubmitButton
            loading={loading}
            className="bg-primary-700 hover:bg-primary-800 focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800"
          >
            Send message
          </LoadingSubmitButton>
        </form>
      </div>
      {showEmailSentToast && <EmailSentToast onDismiss={() => setShowEmailSentToast(false)} />}
    </section>
  )
}

// --- server-side props ---

export { defaultGetServerSideProps as getServerSideProps } from "@/lib/util/get-server-side-props"
