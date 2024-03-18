import { snakeToCamel, SnakeToCamelCase } from "./etc"

const getNonVitalEnvVariable = (environmentVariable: string) => process.env[environmentVariable]
function getVitalEnvVariable(environmentVariable: string): string {
  // NextJs code splitting is hot garb
  if (typeof window !== "undefined") return ""

  const unvalidatedEnvironmentVariable = process.env[environmentVariable]
  if (!unvalidatedEnvironmentVariable) {
    if (process.env.NODE_ENV === "test") {
      console.warn(
        `Couldn't find vital environment variable: ${environmentVariable}. The value 'test val' will be used instead.`,
      )
      return "test_val"
    }
    console.error("process.env: ", process.env)
    throw new Error(`Couldn't find vital environment variable: ${environmentVariable}`)
  } else {
    return unvalidatedEnvironmentVariable
  }
}

type EnvList = readonly string[]
type StringsToObj<T extends EnvList | undefined> = T extends EnvList
  ? { [K in T[number] as SnakeToCamelCase<K>]: string }
  : undefined
type StringsToObjPartial<T extends EnvList | undefined> = T extends EnvList
  ? { [K in T[number] as SnakeToCamelCase<K>]?: string }
  : undefined
type Props = {
  vitalKeys?: EnvList
  nonVitalKeys?: EnvList
}
type Config<T extends Props> = StringsToObj<T["vitalKeys"]> & StringsToObjPartial<T["nonVitalKeys"]>
export function getConfig<TProps extends Props>({
  vitalKeys,
  nonVitalKeys,
}: TProps): Config<TProps> {
  const ret = {} as any
  vitalKeys?.forEach(key => {
    const camelCaseKey = snakeToCamel(key)
    ret[camelCaseKey] = getVitalEnvVariable(key)
  })
  nonVitalKeys?.forEach(key => {
    const camelCaseKey = snakeToCamel(key)
    ret[camelCaseKey] = getNonVitalEnvVariable(key)
  })
  return ret
}
