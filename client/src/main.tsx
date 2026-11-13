import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import './styles.css'
import { AuthProvider } from './lib/auth'
import Layout from './components/Layout'
import CheckPage from './pages/CheckPage'
import ResultPage from './pages/ResultPage'
import LookupPage from './pages/LookupPage'
import ReportPage from './pages/ReportPage'
import CommunityPage from './pages/CommunityPage'
import LearnPage from './pages/LearnPage'
import HomePage from './pages/HomePage'
import DashboardPage from './pages/DashboardPage'
import NotificationsPage from './pages/NotificationsPage'
import { NotificationsProvider } from './lib/notifications'

function NotFound() {
  return <div className="card empty"><h1>Page not found</h1><Link to="/" className="btn btn-primary">Go home</Link></div>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NotificationsProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="check" element={<CheckPage />} />
            <Route path="r/:id" element={<ResultPage />} />
            <Route path="lookup" element={<LookupPage />} />
            <Route path="report" element={<ReportPage />} />
            <Route path="community" element={<CommunityPage />} />
            <Route path="learn" element={<LearnPage />} />
            <Route path="login" element={<Navigate to="/dashboard" replace />} />
            <Route path="signup" element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="history" element={<Navigate to="/dashboard#history" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        </NotificationsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
