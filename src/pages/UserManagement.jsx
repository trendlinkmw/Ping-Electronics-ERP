import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

// The system owner's account is hidden from this list and cannot be
// modified here — protected at the database level too (see setup SQL).
const OWNER_EMAIL = 'trendlinkmw@gmail.com'

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [roles, setRoles] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [busyStatusId, setBusyStatusId] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    const [{ data: p, error: pErr }, { data: r, error: rErr }, { data: a, error: aErr }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, employment_status').order('full_name'),
      supabase.from('roles').select('id, name').order('name'),
      supabase.from('user_roles').select('user_id, role_id')
    ])
    if (pErr || rErr || aErr) setError((pErr || rErr || aErr).message)
    setProfiles((p || []).filter(row => row.email !== OWNER_EMAIL))
    setRoles(r || [])
    setAssignments(a || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const hasRoleAssigned = (userId, roleId) =>
    assignments.some(a => a.user_id === userId && a.role_id === roleId)

  const toggle = async (userId, roleId) => {
    const key = `${userId}-${roleId}`
    setBusyKey(key)
    setError('')
    const already = hasRoleAssigned(userId, roleId)
    try {
      if (already) {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role_id', roleId)
        if (error) throw error
        setAssignments(a => a.filter(x => !(x.user_id === userId && x.role_id === roleId)))
      } else {
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role_id: roleId })
        if (error) throw error
        setAssignments(a => [...a, { user_id: userId, role_id: roleId }])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyKey('')
    }
  }

  const toggleStatus = async (profile) => {
    setBusyStatusId(profile.id)
    setError('')
    const newStatus = profile.employment_status === 'active' ? 'inactive' : 'active'
    try {
      const { error } = await supabase.from('profiles').update({ employment_status: newStatus }).eq('id', profile.id)
      if (error) throw error
      setProfiles(ps => ps.map(p => p.id === profile.id ? { ...p, employment_status: newStatus } : p))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyStatusId('')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100 mb-1">User Management</h1>
      <p className="text-sm text-slate-500 mb-6">
        Tick a role to grant it, untick to remove it. Deactivating a user immediately logs them out and blocks
        further sign-ins.
      </p>

      {error && <div className="text-bad text-sm mb-4">{error}</div>}

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading users…</div>
        ) : profiles.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No other user profiles found.</div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>User</th>
                <th className="text-center">Status</th>
                {roles.map(r => <th key={r.id} className="text-center capitalize">{r.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {profiles.map(p => {
                const isSelf = p.id === currentUser.id
                const isActive = p.employment_status !== 'inactive'
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="text-slate-100">{p.full_name}</div>
                      <div className="text-xs text-slate-500">{p.email}</div>
                      {isSelf && <div className="text-xs text-surge">this is you</div>}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => toggleStatus(p)}
                        disabled={busyStatusId === p.id || isSelf}
                        title={isSelf ? "You can't deactivate your own account" : ''}
                        className={`text-xs px-2 py-1 rounded-full border ${
                          isActive
                            ? 'border-good/40 text-good bg-good/10'
                            : 'border-bad/40 text-bad bg-bad/10'
                        } disabled:opacity-40`}
                      >
                        {isActive ? 'Active' : 'Deactivated'}
                      </button>
                    </td>
                    {roles.map(r => {
                      const checked = hasRoleAssigned(p.id, r.id)
                      const key = `${p.id}-${r.id}`
                      const isSelfAdminBox = isSelf && r.name === 'administrator'
                      return (
                        <td key={r.id} className="text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={busyKey === key || isSelfAdminBox}
                            onChange={() => toggle(p.id, r.id)}
                            className="accent-surge w-4 h-4"
                            title={isSelfAdminBox ? "You can't remove your own administrator role here" : ''}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}