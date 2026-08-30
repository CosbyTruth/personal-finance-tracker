import Constants from 'expo-constants'
import { Platform } from 'react-native'

const configuredUrl = String(process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/$/, '')
const metroHost = String(Constants.expoConfig?.hostUri || '')
  .replace(/^https?:\/\//, '')
  .split(':')[0]
const developmentHost = metroHost || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost')
const localUrl = `http://${developmentHost}:5010`
export const API_URL = configuredUrl || localUrl

type ApiOptions = RequestInit & { token?: string | null }

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers, ...requestOptions } = options
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...requestOptions,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Kora-Client': 'mobile',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    })
  } catch {
    throw new ApiError(
      `Kora cannot reach the API at ${API_URL}. Confirm the API is running and that this phone is on the same Wi-Fi network.`,
      0,
    )
  }

  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(body.message || 'Kora could not complete that request.', response.status)
  return body as T
}

export function formatMoney(value: string | number = 0, currency = 'GHS') {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value) || 0)
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}
