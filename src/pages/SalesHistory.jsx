import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const STATUS_FILTERS = ['all', 'paid', 'partial', 'unpaid']

export default function SalesHistory() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      const { data, error } = await supabase
        .from('sales')
        .select('id, invoice_no, sale_date, total, amount_paid, payment_status, payment_method, customer:customers(name), cashier:profiles!sold_by(full_name)')
        .order('sale_date', { ascending: false })
        .limit(200)
      if (error) setError(error.message)
      setRows(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = rows.filter(r => {
    const matchesSearch =
      r.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
      (r.customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.cashier?.full_name || '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || r.payment_status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusColor = (status) => {
    if (status === 'paid') return 'text-good'
    if (status === 'partial') return 'text-volt'
    return 'text-bad'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-slate-100">Transaction History</h1>
        <div className="flex gap-2">
          <input
            className="input max-w-xs"
            placeholder="Search invoice, customer, cashier…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="input max-w-[140px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUS_FILTERS.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {error && <div className="text-bad text-sm p-4">{error}</div>}
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading transactions…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No transactions match.</div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date & time</th>
                <th>Cashier</th>
                <th>Customer</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Total</th>
                <th>Outstanding</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const outstanding = Number(r.total) - Number(r.amount_paid)
                return (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.invoice_no}</td>
                    <td className="text-slate-400">{new Date(r.sale_date).toLocaleString()}</td>
                    <td>{r.cashier?.full_name || '—'}</td>
                    <td>{r.customer?.name || 'Walk-in'}</td>
                    <td className="capitalize text-slate-400">{r.payment_status === 'unpaid' ? 'On credit' : (r.payment_method || '—').replace('_', ' ')}</td>
                    <td className={`capitalize ${statusColor(r.payment_status)}`}>{r.payment_status}</td>
                    <td className="font-mono">{Number(r.total).toLocaleString()}</td>
                    <td className={outstanding > 0 ? 'font-mono text-volt font-medium' : 'font-mono text-slate-600'}>
                      {outstanding > 0 ? outstanding.toLocaleString() : '—'}
                    </td>
                    <td>
                      <Link to={`/receipt/${r.id}`} className="text-surge text-xs hover:underline">Receipt</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {rows.length === 200 && (
        <p className="text-xs text-slate-500 mt-3">
          Showing the most recent 200 transactions. Older ones aren't loaded here yet — worth adding a date
          range filter or pagination once you have that much history.
        </p>
      )}
    </div>
  )
}