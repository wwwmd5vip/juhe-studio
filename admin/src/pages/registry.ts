/**
 * Page registry: centralized lazy imports with preload support.
 *
 * Every page component is registered here with:
 * - `component`: React.lazy() wrapper
 * - `preload`: function that triggers the dynamic import (call on hover/anticipation)
 *
 * This enables hover-based preloading in Layout.tsx to eliminate
 * the "loading spinner between every page" UX issue.
 */

import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'

// ---------------------------------------------------------------------------
// Type – import function signature that also exposes the module's default export
// ---------------------------------------------------------------------------
type Factory<T> = () => Promise<{ default: T }>

interface PageEntry {
  lazy: LazyExoticComponent<ComponentType<unknown>>
  preload: () => void
}

// ---------------------------------------------------------------------------
// Helper – create a lazy+preload pair from the same import factory
// ---------------------------------------------------------------------------
function page<T extends ComponentType<unknown>>(factory: Factory<T>): PageEntry {
  return {
    lazy: lazy(factory) as LazyExoticComponent<ComponentType<unknown>>,
    preload: factory,
  }
}

// ---------------------------------------------------------------------------
// Public pages
// ---------------------------------------------------------------------------
const Login           = page(() => import('./public/Login'))
const Register        = page(() => import('./public/Register'))
const RegisterSuccess = page(() => import('./public/RegisterSuccess'))
const NotFound        = page(() => import('./public/NotFound'))

// ---------------------------------------------------------------------------
// User pages
// ---------------------------------------------------------------------------
const UserDashboard    = page(() => import('./user/UserDashboard'))
const UserTokens       = page(() => import('./user/Tokens'))
const Recharge         = page(() => import('./user/Recharge'))
const UserBilling      = page(() => import('./user/Billing'))
const Profile          = page(() => import('./user/Profile'))

// ---------------------------------------------------------------------------
// Admin pages
// ---------------------------------------------------------------------------
const Dashboard        = page(() => import('./admin/Dashboard'))
const Users            = page(() => import('./admin/Users'))
const Channels         = page(() => import('./admin/Channels'))
const Prompts          = page(() => import('./admin/Prompts'))
const Models           = page(() => import('./admin/Models'))
const Pricing          = page(() => import('./admin/Pricing'))
const AdminTokens      = page(() => import('./admin/AdminTokens'))
const TopUps           = page(() => import('./admin/TopUps'))
const Redemptions      = page(() => import('./admin/Redemptions'))
const DailyBills       = page(() => import('./admin/DailyBills'))
const QuotaTransactions = page(() => import('./admin/QuotaTransactions'))
const Logs             = page(() => import('./admin/Logs'))
const QuotaPackages    = page(() => import('./admin/QuotaPackages'))
const Subscriptions    = page(() => import('./admin/Subscriptions'))
const Vendors          = page(() => import('./admin/Vendors'))
const Releases         = page(() => import('./admin/Releases'))
const Settings         = page(() => import('./admin/Settings'))
const AuditLogs        = page(() => import('./admin/AuditLogs'))
const SystemHealth     = page(() => import('./admin/SystemHealth'))
const Playground       = page(() => import('./admin/Playground'))
const Feedbacks        = page(() => import('./admin/Feedbacks'))

// ---------------------------------------------------------------------------
// Route → preload mapping – used by Layout.tsx for hover-triggered preloading
// ---------------------------------------------------------------------------
export const pagePreloadMap: Record<string, () => void> = {
  // public
  '/login':              Login.preload,
  '/register':           Register.preload,
  '/register-success':   RegisterSuccess.preload,

  // user
  '/dashboard':          UserDashboard.preload,
  '/tokens':             UserTokens.preload,
  '/recharge':           Recharge.preload,
  '/billing':            UserBilling.preload,
  '/profile':            Profile.preload,

  // admin
  '/admin':              Dashboard.preload,
  '/admin/tokens':       AdminTokens.preload,
  '/users':              Users.preload,
  '/channels':           Channels.preload,
  '/prompts':            Prompts.preload,
  '/models':             Models.preload,
  '/pricing':            Pricing.preload,
  '/topups':             TopUps.preload,
  '/redemptions':        Redemptions.preload,
  '/daily-bills':        DailyBills.preload,
  '/quota-transactions': QuotaTransactions.preload,
  '/logs':               Logs.preload,
  '/quota-packages':     QuotaPackages.preload,
  '/subscriptions':      Subscriptions.preload,
  '/vendors':            Vendors.preload,
  '/releases':           Releases.preload,
  '/audit-logs':         AuditLogs.preload,
  '/settings':           Settings.preload,
  '/system-health':      SystemHealth.preload,
  '/playground':         Playground.preload,
  '/feedbacks':          Feedbacks.preload,
}

// ---------------------------------------------------------------------------
// Components – lazy wrappers for use in <Route element={…}>
// ---------------------------------------------------------------------------
export {
  // public
  Login,
  Register,
  RegisterSuccess,
  NotFound,

  // user
  UserDashboard,
  UserTokens,
  Recharge,
  UserBilling,
  Profile,

  // admin
  Dashboard,
  Users,
  Channels,
  Prompts,
  Models,
  Pricing,
  AdminTokens,
  TopUps,
  Redemptions,
  DailyBills,
  QuotaTransactions,
  Logs,
  QuotaPackages,
  Subscriptions,
  Vendors,
  Releases,
  Settings,
  AuditLogs,
  SystemHealth,
  Playground,
  Feedbacks,
}
