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

export async function fetchJsonData<T = any>(url: string, accessToken?: string): Promise<T> {
  const headers: HeadersInit = {
    Accept: "application/json",
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const response = await fetch(url, {
    headers,
  })

  const responseContent = await getResponseContent(response)
  if (!response.ok) {
    throw new Error(`GET request to url: ${url} failed, error: ${JSON.stringify(responseContent)}}`)
  }

  return responseContent as T
}

export async function postJsonData<T = any>(url: string, json?: any): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: json && JSON.stringify(json),
  })

  const responseContent = await getResponseContent(response)
  if (!response.ok) {
    console.error(`POST request to url: ${url} failed, error: ${responseContent}}`)
    throw new ApiError(response.status, responseContent)
  }

  return responseContent as T
}

export async function deleteJsonData<T = any>(url: string, json?: any): Promise<T> {
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: json && JSON.stringify(json),
  })

  const responseContent = await getResponseContent(response)
  if (!response.ok) {
    throw new Error(`DELETE request to url: ${url} failed, error: ${responseContent}}`)
  }

  return responseContent as T
}

export async function putJsonData<T = any>(url: string, json?: any): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: json && JSON.stringify(json),
  })

  const responseContent = await getResponseContent(response)
  if (!response.ok) {
    throw new Error(`PUT request to url: ${url} failed, error: ${responseContent}}`)
  }

  return responseContent as T
}
