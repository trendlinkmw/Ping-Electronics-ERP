import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function CustomerDetail() {
  const { id } = useParams()
  const [customer, setCustomer] = useState(null)
  const [sales, setSales] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      const [{ data: c, error: cErr }, { data: s }, { data: p }] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        supabase.from('sales').select('id, invoice_no, sale_date, total, amount_paid, payment_status').eq('customer_id', id).order('sale_date', { ascending: false }),
        supabase.from('payments').select('amount, method, payment_date').eq('customer_id', id).order('payment_date', { ascending: false }),
      ])
      if (cErr) setError(cErr.message)
      setCustomer(c || null)
      setSales(s || [])
      setPayments(p || [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="text-sm text-slate-500">Loading…</div>
  if (error || !customer) return <div className="text-bad text-sm">{error || 'Customer not found.'}</div>

  const totalSpent = sales.reduce((s, r) => s + Number(r.total), 0)
  const totalOwed = sales.reduce((s, r) => s + (Number(r.total) - Number(r.amount_paid)), 0)

  return (
    <div>
      <Link to="/customers" className="text-sm text-surge hover:underline mb-4 inline-block">← All customers</Link>

      <div className="card p-5 mb-6">
        <h1 className="text-2xl font-semibold text-slate-100 mb-1">{customer.name}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-sm">
          <div><div className="text-xs uppercase text-slate-400 mb-1">Phone</div><div className="text-slate-100">{customer.phone || '—'}</div></div>
          <div><div className="text-xs uppercase text-slate-400 mb-1">Email</div><div className="text-slate-100">{customer.email || '—'}</div></div>
          <div><div className="text-xs uppercase text-slate-400 mb-1">Address</div><div className="text-slate-100">{customer.address || '—'}</div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-xs uppercase text-slate-400 mb-1">Total spent</div>
          <div className="text-xl font-semibold text-surge">MWK {totalSpent.toLocaleString()}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase text-slate-400 mb-1">Total transactions</div>
          <div className="text-xl font-semibold text-slate-100">{sales.length}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase text-slate-400 mb-1">Currently owed</div>
          <div className={`text-xl font-semibold ${totalOwed > 0 ? 'text-volt' : 'text-good'}`}>MWK {totalOwed.toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-x-auto">
          <div className="px-4 pt-4 font-medium text-slate-100">Purchase history</div>
          {sales.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No purchases yet.</div>
          ) : (
            <table className="table-base mt-2">
              <thead><tr><th>Invoice</th><th>Date</th><th>Total</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {sales.map(s => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs">{s.invoice_no}</td>
                    <td className="text-slate-400">{new Date(s.sale_date).toLocaleDateString()}</td>
                    <td className="font-mono">{Number(s.total).toLocaleString()}</td>
                    <td className="capitalize">{s.payment_status}</td>
                    <td><Link to={`/receipt/${s.id}`} className="text-surge text-xs hover:underline">Receipt</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card overflow-x-auto">
          <div className="px-4 pt-4 font-medium text-slate-100">Payment history</div>
          {payments.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No payments recorded yet.</div>
          ) : (
            <table className="table-base mt-2">
              <thead><tr><th>Date</th><th>Method</th><th>Amount</th></tr></thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={i}>
                    <td className="text-slate-400">{new Date(p.payment_date).toLocaleDateString()}</td>
                    <td className="capitalize text-slate-400">{p.method.replace('_', ' ')}</td>
                    <td className="font-mono text-good">{Number(p.amount).toLocaleString()}</td>
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