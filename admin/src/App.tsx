import { Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConfigProvider, Spin, theme as antdTheme } from 'antd'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import HomeRedirect from './components/HomeRedirect'
import ErrorBoundary from './components/ErrorBoundary'
import { useThemeStore } from './stores/themeStore'
import { themeTokens } from './styles/theme-tokens'
import {
  Login,
  Register,
  RegisterSuccess,
  NotFound,
  UserDashboard,
  UserTokens,
  Recharge,
  UserBilling,
  Profile,
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
} from './pages/registry'

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Spin size="large" />
    </div>
  )
}

function AppRouter() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* ---- public ---- */}
            <Route path="/login" element={<Login.lazy />} />
            <Route path="/register" element={<Register.lazy />} />
            <Route path="/register-success" element={<RegisterSuccess.lazy />} />

            {/* ---- authenticated ---- */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<HomeRedirect />} />

                {/* user */}
                <Route path="/dashboard" element={<UserDashboard.lazy />} />
                <Route path="/tokens" element={<UserTokens.lazy />} />
                <Route path="/recharge" element={<Recharge.lazy />} />
                <Route path="/billing" element={<UserBilling.lazy />} />
                <Route path="/profile" element={<Profile.lazy />} />

                {/* admin */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<Dashboard.lazy />} />
                  <Route path="/admin/tokens" element={<AdminTokens.lazy />} />
                  <Route path="/users" element={<Users.lazy />} />
                  <Route path="/channels" element={<Channels.lazy />} />
                  <Route path="/prompts" element={<Prompts.lazy />} />
                  <Route path="/models" element={<Models.lazy />} />
                  <Route path="/pricing" element={<Pricing.lazy />} />
                  <Route path="/topups" element={<TopUps.lazy />} />
                  <Route path="/redemptions" element={<Redemptions.lazy />} />
                  <Route path="/daily-bills" element={<DailyBills.lazy />} />
                  <Route path="/quota-transactions" element={<QuotaTransactions.lazy />} />
                  <Route path="/logs" element={<Logs.lazy />} />
                  <Route path="/quota-packages" element={<QuotaPackages.lazy />} />
                  <Route path="/subscriptions" element={<Subscriptions.lazy />} />
                  <Route path="/vendors" element={<Vendors.lazy />} />
                  <Route path="/releases" element={<Releases.lazy />} />
                  <Route path="/audit-logs" element={<AuditLogs.lazy />} />
                  <Route path="/settings" element={<Settings.lazy />} />
                  <Route path="/system-health" element={<SystemHealth.lazy />} />
                  <Route path="/playground" element={<Playground.lazy />} />
                  <Route path="/feedbacks" element={<Feedbacks.lazy />} />
                </Route>
              </Route>
            </Route>

            {/* ---- 404 ---- */}
            <Route path="*" element={<NotFound.lazy />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

function App() {
  const { theme } = useThemeStore()
  return (
    <ConfigProvider
      getPopupContainer={() => document.getElementById('root') || document.body}
      theme={{
        ...themeTokens,
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <AppRouter />
    </ConfigProvider>
  )
}

export default App
