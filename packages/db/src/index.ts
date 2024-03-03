import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"

import * as schema from "db/schema"
import { config } from "./env"

const { nodeEnv, devDbLocation, libSqlDbUrl, libSqlAuthToken } = config

const sqlite =
  nodeEnv === "development" || nodeEnv === "test"
    ? createClient({ url: `file:${devDbLocation || "test.db"}` })
    : createClient({ url: libSqlDbUrl, authToken: libSqlAuthToken })

export const db = drizzle(sqlite, { schema })
export * from "db/schema"
export * from "./firebase"
