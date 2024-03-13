import { DataType as CheckoutSessionDataType } from "@/pages/api/stripe/create-checkout-session"
import { config } from "@/lib/env"
import { fetchJsonData } from "utils/dist/request"

const { vercelEnv, vercelBranchUrl, vercelUrl, productionUrl } = config

export async function subscribe(redirect?: string) {
  const data: CheckoutSessionDataType = { redirect }
  const { url } = await fetchJsonData("/api/stripe/create-checkout-session", {
    method: "POST",
    body: data,
  })

  if (typeof url !== "string") throw new Error()

  window.location.replace(url)
}

const formatUrl = (url: string) => `https://${url}${url.at(-1) === "/" ? "" : "/"}`
export const getBaseUrl = () => {
  if (vercelEnv === "preview") return formatUrl(vercelBranchUrl ?? "")
  if (vercelEnv === "production") return formatUrl(productionUrl ?? vercelUrl ?? "")
  return "http://localhost:3000/"
}
