import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, allow }) {
  const { session, loading, hasRole } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink text-slate-400 text-sm">
        Loading TrendLink…
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (allow && !hasRole(...allow, 'administrator')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink text-slate-400 text-sm">
        You don't have access to this module. Ask an administrator to grant you the right role.
      </div>
    )
  }

  return children
}
