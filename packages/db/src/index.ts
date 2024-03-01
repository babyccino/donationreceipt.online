import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"

import * as schema from "db/schema"
import { config } from "./env"

const sqlite =
  config.nodeEnv === "development" || config.nodeEnv === "test"
    ? createClient({ url: "file:test.db" })
    : createClient({ url: config.libSqlDbUrl, authToken: config.libSqlAuthToken })
export const db = drizzle(sqlite, { schema })
export * from "db/schema"
export * from "./firebase"
