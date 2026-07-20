export type User = {
  id: number
  email: string
  name: string
  lastName: string
  weight: number | null
  height: number | null
  dateOfBirth: string | null
  unitPreference: string | null
  weekStartDay: number | null
  avatar: string | null
}

export type ApiToken = {
  id: number
  name: string
  tokenPrefix: string
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

export type CreatedApiToken = ApiToken & { token: string }
