import type Link from "next/link"
import type { ComponentProps } from "react"

export const buttonStyling =
  "inline-block text-white bg-primary-700 hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 font-medium rounded-lg text-sm px-[1.125rem] py-2.5 dark:bg-primary-600 dark:hover:bg-primary-700 focus:outline-none dark:focus:ring-primary-800 border border-transparent cursor-pointer"

export const DumbLink = (props: ComponentProps<typeof Link>) => (
  <a {...(props as any)} className={`${props.className} ${buttonStyling}`}></a>
)
