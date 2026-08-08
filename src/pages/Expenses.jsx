import { useState } from 'react'
import { useTable } from '../lib/useTable'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = ['salaries','rent','utilities','airtime','internet','marketing','transport','repairs','miscellaneous']
const empty = { category: 'miscellaneous', amount: '', description: '', payment_method: 'cash', expense_date: new Date().toISOString().slice(0,10) }

export default function Expenses() {
  const { rows, loading, error, insert } = useTable('expenses', {
    orderBy: 'expense_date',
    ascending: false,
    select: 'id, category, amount, description, payment_method, expense_date, recorded_by, recordedBy:profiles!recorded_by(full_name)'
  })
  const { user } = useAuth()
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      await insert({ ...form, amount: Number(form.amount), recorded_by: user.id })
      setForm(empty)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const monthTotal = rows
    .filter(r => r.expense_date?.slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-100">Expenses</h1>
        <div className="text-sm text-slate-400">This month: <span className="text-volt font-mono">MWK {monthTotal.toLocaleString()}</span></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={submit} className="card p-5 h-fit space-y-3">
          <div className="font-medium text-slate-100 mb-1">Record expense</div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Amount</label>
            <input type="number" step="0.01" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Payment method</label>
            <select className="input" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="airtel_money">Airtel Money</option>
              <option value="tnm_mpamba">TNM Mpamba</option>
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          {formError && <div className="text-bad text-sm">{formError}</div>}
          <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Record expense'}</button>
        </form>

        <div className="card lg:col-span-2 overflow-x-auto">
          {error && <div className="text-bad text-sm p-4">{error}</div>}
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading expenses…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No expenses recorded yet.</div>
          ) : (
            <table className="table-base">
              <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>By</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="text-slate-400">{r.expense_date}</td>
                    <td className="capitalize">{r.category}</td>
                    <td className="text-slate-400">{r.description || '—'}</td>
                    <td className="font-mono">{Number(r.amount).toLocaleString()}</td>
                    <td className="text-slate-400">{r.recordedBy?.full_name || '—'}</td>
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