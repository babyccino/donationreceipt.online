import { getConfig } from "utils/dist/config"

const vitalKeys = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",

  "LIB_SQL_DB_URL",
  "LIB_SQL_AUTH_TOKEN",

  "SENTRY_AUTH_TOKEN",

  "DOMAIN",
  "SNS_ARN",
] as const
const nonVitalKeys = ["TEST_EMAIL"] as const
export const config = getConfig({ vitalKeys, nonVitalKeys })
