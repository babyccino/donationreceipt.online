export const supportedCountries = ["us", "ca", "gb", "au"] as const
export type SupportedCountries = "us" | "ca" | "gb" | "au"
export type SupportedCurrencies = "usd" | "cad" | "gbp" | "aud"

export function getCurrency(country: SupportedCountries) {
  switch (country) {
    case "ca":
      return "cad"
    case "gb":
      return "gbp"
    case "au":
      return "aud"
    case "us":
    default:
      return "usd"
  }
}

export function getPrice(currency: SupportedCurrencies) {
  switch (currency) {
    case "usd":
      return 25
    case "cad":
      return 35
    case "gbp":
      return 20
    case "aud":
      return 40
  }
}

export function getCurrencySymbol(currency: SupportedCurrencies) {
  switch (currency) {
    case "gbp":
      return "£"
    case "usd":
    case "cad":
    case "aud":
      return "$"
  }
}

export function getCountryFlag(country: SupportedCountries) {
  switch (country) {
    case "us":
      return "🇺🇸"
    case "ca":
      return "🇨🇦"
    case "gb":
      return "🇬🇧"
    case "au":
      return "🇦🇺"
  }
}

export function getCountryName(country: SupportedCountries) {
  switch (country) {
    case "us":
      return "United States"
    case "ca":
      return "Canada"
    case "gb":
      return "United Kingdom"
    case "au":
      return "Australia"
  }
}
