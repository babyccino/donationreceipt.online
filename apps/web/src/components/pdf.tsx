import { XMarkIcon } from "@heroicons/react/24/solid"
import { BlobProvider } from "@react-pdf/renderer"
import { Button } from "components/dist/ui/button"
import { Spinner } from "components/dist/ui/spinner"
import { useRef, useState } from "react"
import { Document, Page } from "react-pdf"

import { ReceiptPdfDocument } from "components/dist/receipt/pdf"
import { showReceiptInner } from "components/dist/receipt/pdf-dumb"
import { EmailProps } from "components/dist/receipt/types"

import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

import { createPortal } from "react-dom"
import { pdfjs } from "react-pdf"
import { dummyEmailProps } from "@/emails/props"
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "../../../../node_modules/pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url,
).toString()

export function ShowReceipt({ receiptProps }: { receiptProps: EmailProps }) {
  const [show, setShow] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)
  const childRef = useRef<HTMLDivElement>(null)

  const button = (
    <Button onClick={() => setShow(true)} color="blue">
      {showReceiptInner}
    </Button>
  )

  if (!show) return button

  const receipt = (
    <div
      className="fixed inset-0 z-40 mr-[-9px] flex flex-row justify-center overflow-y-scroll overscroll-contain bg-black bg-opacity-50"
      onClick={e => {
        if (e.target === e.currentTarget) setShow(false)
      }}
    >
      <div
        id="pdf"
        ref={parentRef}
        className="z-50 m-4 w-full max-w-[800px] rounded-md bg-gray-800"
      >
        <div className="flex flex-row justify-end p-2">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white"
            onClick={() => setShow(false)}
          >
            <XMarkIcon className="w-6" />
            <span className="sr-only">Close modal</span>
          </button>
        </div>
        <BlobProvider document={<ReceiptPdfDocument {...receiptProps} />}>
          {({ url, loading }) =>
            loading ? (
              <Spinner className="relative left-[calc(50%-1.25rem)] top-[calc(50%-1.25rem)] h-10 w-10" />
            ) : (
              <Document file={url} loading={loading ? <Spinner className="h-10 w-10" /> : null}>
                <Page
                  loading={loading ? <Spinner className="h-10 w-10" /> : null}
                  pageNumber={1}
                  error={"Error"}
                  width={parentRef.current?.clientWidth}
                  inputRef={childRef}
                />
              </Document>
            )
          }
        </BlobProvider>
      </div>
    </div>
  )

  return (
    <>
      {button}
      {createPortal(receipt, document.body)}
    </>
  )
}

export const TestViewReceipt = () => {
  const parentRef = useRef<HTMLDivElement>(null)

  return (
    <div id="pdf" ref={parentRef} className="z-50 m-4 w-full max-w-[800px] rounded-md bg-gray-800">
      <BlobProvider document={<ReceiptPdfDocument {...dummyEmailProps} />}>
        {({ url, loading }) =>
          loading ? (
            <Spinner className="relative left-[calc(50%-1.25rem)] top-[calc(50%-1.25rem)] h-10 w-10" />
          ) : (
            <Document file={url} loading={loading ? <Spinner className="h-10 w-10" /> : null}>
              <Page
                loading={loading ? <Spinner className="h-10 w-10" /> : null}
                pageNumber={1}
                error={"Error"}
                width={parentRef.current?.clientWidth}
              />
            </Document>
          )
        }
      </BlobProvider>
    </div>
  )
}
