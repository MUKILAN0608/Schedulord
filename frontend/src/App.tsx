import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { RootState } from './store/store'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
import LoginPortal from './pages/LoginPortal'
import DashboardPage from './pages/DashboardPage'
import ResourcesPage from './pages/ResourcesPage'
import AdminResourcesPage from './pages/AdminResourcesPage'
import RequestsPage from './pages/RequestsPage'
import DecisionPage from './pages/DecisionPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AdminManagePage from './pages/AdminManagePage'
import AdminRequestDecisionsPage from './pages/AdminRequestDecisionsPage'
import MonitoringPage from './pages/MonitoringPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuth = useSelector((s: RootState) => s.auth.isAuthenticated)
  if (!isAuth) return <Navigate to="/" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useSelector((s: RootState) => s.auth.user)
  if (!user || user.role !== 'admin') return <Navigate to="/panel/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login/admin" element={<LoginPortal role="admin" />} />
      <Route path="/login/client" element={<LoginPortal role="client" />} />
      
      <Route path="/panel" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="admin-resources" element={<AdminRoute><AdminResourcesPage /></AdminRoute>} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="decisions" element={<DecisionPage />} />
        <Route path="admin-request-decisions" element={<AdminRoute><AdminRequestDecisionsPage /></AdminRoute>} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="admin-manage" element={<AdminRoute><AdminManagePage /></AdminRoute>} />
        <Route path="monitoring" element={<AdminRoute><MonitoringPage /></AdminRoute>} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
