import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from './routeTree'
import { ToastProvider } from './lib/toast'
import './index.css'

import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_FRONTEND_SENTRY_DSN,
  enabled: !!import.meta.env.VITE_FRONTEND_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration()
  ],
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", /^https:\/\/mytrainning\.up\.railway\.app\/api/],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true
});

const queryClient = new QueryClient()

const router = createRouter({
  routeTree,
  context: { queryClient },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
