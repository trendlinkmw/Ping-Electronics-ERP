import { useState } from 'react'
import { useTable } from '../lib/useTable'
import { useAuth } from '../context/AuthContext'

const empty = { name: '', phone: '', email: '', address: '' }

export default function Customers() {
  const { rows, loading, error, insert } = useTable('customers', { orderBy: 'name', ascending: true })
  const { user } = useAuth()
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      await insert({ ...form, created_by: user.id })
      setForm(empty)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100 mb-6">Customers</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={submit} className="card p-5 h-fit space-y-3">
          <div className="font-medium text-slate-100 mb-1">Add customer</div>
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          {formError && <div className="text-bad text-sm">{formError}</div>}
          <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Add customer'}</button>
        </form>

        <div className="card lg:col-span-2 overflow-x-auto">
          {error && <div className="text-bad text-sm p-4">{error}</div>}
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading customers…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No customers yet.</div>
          ) : (
            <table className="table-base">
              <thead><tr><th>Name</th><th>Phone</th><th>Credit balance</th></tr></thead>
              <tbody>
                {rows.map(c => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="text-slate-400">{c.phone || '—'}</td>
                    <td className={Number(c.credit_balance) > 0 ? 'text-volt font-mono' : 'font-mono text-slate-500'}>
                      {Number(c.credit_balance).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
