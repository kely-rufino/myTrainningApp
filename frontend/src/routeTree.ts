import { createRootRouteWithContext, createRoute, Outlet, redirect } from '@tanstack/react-router'
import { createElement } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { meQueryOptions } from './lib/queries'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import HomePage from './pages/HomePage'
import AppLayout from './components/AppLayout'
import ProfilePage from './pages/ProfilePage'
import WorkoutsPage from './pages/WorkoutsPage'
import WorkoutBuilderPage from './pages/WorkoutBuilderPage'
import ExercisesPage from './pages/ExercisesPage'
import CalendarPage from './pages/CalendarPage'

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => createElement(Outlet),
})

// Unprotected layout
const authLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: '_auth',
  component: () => createElement(Outlet),
})

const loginRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/login',
  component: LoginPage,
})

const signUpRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/signup',
  component: SignUpPage,
})

const forgotPasswordRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/forgot-password',
  component: ForgotPasswordPage,
})

// Protected layout — redirects to /login if not authenticated
const appLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  component: AppLayout,
  beforeLoad: async ({ context: { queryClient } }) => {
    try {
      await queryClient.ensureQueryData(meQueryOptions)
    } catch {
      throw redirect({ to: '/login' })
    }
  },
})

const homeRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/',
  component: HomePage,
})

const profileRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/profile',
  component: ProfilePage,
})

const workoutsRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/workouts',
  component: WorkoutsPage,
})

export const workoutBuilderRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/workouts/$id',
  component: WorkoutBuilderPage,
})

const exercisesRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/exercises',
  component: ExercisesPage,
})

const calendarRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/calendar',
  component: CalendarPage,
})

export const routeTree = rootRoute.addChildren([
  authLayout.addChildren([loginRoute, signUpRoute, forgotPasswordRoute]),
  appLayout.addChildren([homeRoute, profileRoute, workoutsRoute, workoutBuilderRoute, exercisesRoute, calendarRoute]),
])
