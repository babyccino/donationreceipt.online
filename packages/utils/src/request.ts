import { TypeOf, ZodObject, ZodRawShape } from "zod"

import { ApiError } from "./error"

export function parseRequestBody<T extends ZodRawShape>(
  shape: ZodObject<T>,
  body: any,
): TypeOf<ZodObject<T>> {
  const response = shape.safeParse(body)

  if (!response.success) {
    const { errors } = response.error

    throw new ApiError(400, JSON.stringify(errors))
  }

  return response.data
}

export async function getResponseContent(response: Response) {
  const contentType = response.headers.get("content-type")
  if (contentType && contentType.includes("application/json")) {
    return response.json()
  } else {
    return await response.text()
  }
}

type Method = "GET" | "POST" | "PUT" | "DELETE"
export async function fetchJsonData<T = any>(
  url: string,
  config?: { method?: Method; bearer?: string; headers?: Record<string, string>; body?: any },
): Promise<T> {
  const method = config?.method ?? "GET"
  const headers: HeadersInit = {
    Accept: "application/json",
    ...config?.headers,
  }
  if (config?.bearer) headers.Authorization = `Bearer ${config.bearer}`
  if (config?.body) headers["Content-Type"] = "application/json"
  if (config?.method === "GET" && config?.body) {
    console.warn("GET request made with body")
  }
  const fetchOptions = {
    method,
    headers,
    body: config ? config.body && JSON.stringify(config.body) : undefined,
  }
  const response = await fetch(url, fetchOptions)

  const responseContent = await getResponseContent(response)
  if (!response.ok) {
    throw new Error(
      `${method} request to url: ${url} failed, error: ${JSON.stringify(responseContent)}}`,
    )
  }

  return responseContent as T
}
