import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function SupplierDetail() {
  const { id } = useParams()
  const [supplier, setSupplier] = useState(null)
  const [purchases, setPurchases] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      const [{ data: s, error: sErr }, { data: p }, { data: pay }] = await Promise.all([
        supabase.from('suppliers').select('*').eq('id', id).single(),
        supabase.from('purchases').select('id, reference_no, purchase_date, total, amount_paid, payment_status').eq('supplier_id', id).order('purchase_date', { ascending: false }),
        supabase.from('payments').select('amount, method, payment_date').eq('supplier_id', id).order('payment_date', { ascending: false }),
      ])
      if (sErr) setError(sErr.message)
      setSupplier(s || null)
      setPurchases(p || [])
      setPayments(pay || [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="text-sm text-slate-500">Loading…</div>
  if (error || !supplier) return <div className="text-bad text-sm">{error || 'Supplier not found.'}</div>

  const totalPurchased = purchases.reduce((s, r) => s + Number(r.total), 0)
  const totalOwed = purchases.reduce((s, r) => s + (Number(r.total) - Number(r.amount_paid)), 0)

  return (
    <div>
      <Link to="/suppliers" className="text-sm text-surge hover:underline mb-4 inline-block">← All suppliers</Link>

      <div className="card p-5 mb-6">
        <h1 className="text-2xl font-semibold text-slate-100 mb-1">{supplier.name}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-sm">
          <div><div className="text-xs uppercase text-slate-400 mb-1">Phone</div><div className="text-slate-100">{supplier.phone || '—'}</div></div>
          <div><div className="text-xs uppercase text-slate-400 mb-1">Email</div><div className="text-slate-100">{supplier.email || '—'}</div></div>
          <div><div className="text-xs uppercase text-slate-400 mb-1">Address</div><div className="text-slate-100">{supplier.address || '—'}</div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-xs uppercase text-slate-400 mb-1">Total purchased</div>
          <div className="text-xl font-semibold text-surge">MWK {totalPurchased.toLocaleString()}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase text-slate-400 mb-1">Total orders</div>
          <div className="text-xl font-semibold text-slate-100">{purchases.length}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase text-slate-400 mb-1">We owe them</div>
          <div className={`text-xl font-semibold ${totalOwed > 0 ? 'text-volt' : 'text-good'}`}>MWK {totalOwed.toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-x-auto">
          <div className="px-4 pt-4 font-medium text-slate-100">Purchase orders</div>
          {purchases.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No purchase orders yet.</div>
          ) : (
            <table className="table-base mt-2">
              <thead><tr><th>Reference</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.reference_no}</td>
                    <td className="text-slate-400">{new Date(p.purchase_date).toLocaleDateString()}</td>
                    <td className="font-mono">{Number(p.total).toLocaleString()}</td>
                    <td className="capitalize">{p.payment_status}</td>
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