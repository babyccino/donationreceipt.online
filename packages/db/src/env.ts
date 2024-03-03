import { getConfig } from "utils/dist/config"

const vitalKeys = [
  "NODE_ENV",
  "LIB_SQL_DB_URL",
  "LIB_SQL_AUTH_TOKEN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
] as const
const nonVitalKeys = ["DEV_DB_LOCATION"] as const
export const config = getConfig({ vitalKeys, nonVitalKeys })
