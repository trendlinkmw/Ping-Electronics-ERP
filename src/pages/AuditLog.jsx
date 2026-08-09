import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const ACTION_LABELS = {
  employment_status_change: 'Account status changed',
  role_granted: 'Role granted',
  role_revoked: 'Role revoked',
  price_change: 'Price changed',
  login: 'Signed in',
  logout: 'Signed out',
}

function describeChange(log) {
  const prev = log.previous_value || {}
  const next = log.new_value || {}

  switch (log.action) {
    case 'login':
      return 'Session started'
    case 'logout':
      return 'Session ended'
    case 'employment_status_change':
      return `${prev.email || '—'}: ${prev.employment_status || '?'} → ${next.employment_status || '?'}`
    case 'role_granted':
      return `${next.target_user || 'Unknown user'} — granted "${next.role || '?'}"`
    case 'role_revoked':
      return `${prev.target_user || 'Unknown user'} — removed "${prev.role || '?'}"`
    case 'price_change': {
      const parts = []
      if (prev.buying_price !== next.buying_price) parts.push(`buying ${prev.buying_price} → ${next.buying_price}`)
      if (prev.selling_price !== next.selling_price) parts.push(`selling ${prev.selling_price} → ${next.selling_price}`)
      return `${next.name || prev.name || '—'}: ${parts.join(', ')}`
    }
    default:
      return JSON.stringify(next || prev)
  }
}

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, module, previous_value, new_value, created_at, actor:profiles!user_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(300)
      if (error) setError(error.message)
      setLogs(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = filter === 'all' ? logs : logs.filter(l => l.action === filter)
  const actionTypes = [...new Set(logs.map(l => l.action))]

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-slate-100">Audit Log</h1>
        <select className="input max-w-[220px]" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All actions</option>
          {actionTypes.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
        </select>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Automatically recorded at the database level — account status changes, role grants/revokes, and
        product price changes, regardless of how they were made.
      </p>

      {error && <div className="text-bad text-sm mb-4">{error}</div>}

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No audit entries yet.</div>
        ) : (
          <table className="table-base">
            <thead><tr><th>Date & time</th><th>By</th><th>Action</th><th>Details</th></tr></thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td className="text-slate-400">{new Date(l.created_at).toLocaleString()}</td>
                  <td>{l.actor?.full_name || 'System'}</td>
                  <td className="text-slate-300">{ACTION_LABELS[l.action] || l.action}</td>
                  <td className="text-slate-400">{describeChange(l)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}