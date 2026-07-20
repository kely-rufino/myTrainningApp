import { queryOptions } from '@tanstack/react-query'
import { apiFetch } from './api'
import type { ApiToken, User } from './types'

export const meQueryOptions = queryOptions({
  queryKey: ['me'],
  queryFn: () => apiFetch<User>('/auth/me'),
  retry: false,
  staleTime: Infinity,
})

export const apiTokensQueryOptions = queryOptions({
  queryKey: ['apiTokens'],
  queryFn: () => apiFetch<ApiToken[]>('/tokens'),
})
