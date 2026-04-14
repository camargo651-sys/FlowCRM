export interface CurrencyInfo {
  code: string
  symbol: string
  name: string
  decimals: number
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', symbol: '$',  name: 'US Dollar',          decimals: 2 },
  { code: 'EUR', symbol: '€',  name: 'Euro',               decimals: 2 },
  { code: 'GBP', symbol: '£',  name: 'British Pound',      decimals: 2 },
  { code: 'MXN', symbol: '$',  name: 'Mexican Peso',       decimals: 2 },
  { code: 'COP', symbol: '$',  name: 'Colombian Peso',     decimals: 0 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real',     decimals: 2 },
  { code: 'ARS', symbol: '$',  name: 'Argentine Peso',     decimals: 2 },
  { code: 'CLP', symbol: '$',  name: 'Chilean Peso',       decimals: 0 },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol',       decimals: 2 },
]

export const CURRENCY_CODES = SUPPORTED_CURRENCIES.map(c => c.code)

export function getCurrencyInfo(code: string): CurrencyInfo {
  return SUPPORTED_CURRENCIES.find(c => c.code === code) || SUPPORTED_CURRENCIES[0]
}

/** Format a numeric amount according to the given currency (default USD). */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const info = getCurrencyInfo(currency)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: info.code,
      minimumFractionDigits: info.decimals,
      maximumFractionDigits: info.decimals,
    }).format(amount || 0)
  } catch {
    return `${info.symbol}${(amount || 0).toFixed(info.decimals)}`
  }
}

// TODO: wire to a real FX rates provider (e.g. exchangerate.host, openexchangerates).
// Rates are USD-based reference values for placeholder use only.
const FALLBACK_RATES_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  MXN: 17.1,
  COP: 4100,
  BRL: 5.0,
  ARS: 1000,
  CLP: 950,
  PEN: 3.75,
}

/**
 * Convert an amount between currencies.
 * @param rates Optional override map (currency -> USD rate). Falls back to placeholder rates.
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates?: Record<string, number>
): number {
  if (from === to) return amount
  const r = rates || FALLBACK_RATES_USD
  const fromRate = r[from] ?? FALLBACK_RATES_USD[from] ?? 1
  const toRate = r[to] ?? FALLBACK_RATES_USD[to] ?? 1
  // amount in `from` -> USD -> `to`
  const usd = amount / fromRate
  return usd * toRate
}
