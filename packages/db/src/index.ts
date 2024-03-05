import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"

import * as schema from "db/schema"
import { getConfig } from "utils/dist/config"

const vitalKeys = ["NODE_ENV", "LIB_SQL_DB_URL", "LIB_SQL_AUTH_TOKEN"] as const
const nonVitalKeys = ["DEV_DB_LOCATION"] as const
const config = getConfig({ vitalKeys, nonVitalKeys })

const { nodeEnv, devDbLocation, libSqlDbUrl, libSqlAuthToken } = config

const sqlite =
  nodeEnv === "development" || nodeEnv === "test"
    ? createClient({ url: `file:${devDbLocation || "test.db"}` })
    : createClient({ url: libSqlDbUrl, authToken: libSqlAuthToken })

export const db = drizzle(sqlite, { schema })
export * from "db/schema"
