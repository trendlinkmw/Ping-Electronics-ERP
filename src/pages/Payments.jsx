import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useTable } from '../lib/useTable'

export default function Payments() {
  const { user } = useAuth()
  const [tab, setTab] = useState('customer') // 'customer' | 'supplier'

  const { rows: payments, loading: paymentsLoading, refresh: refreshPayments } =
    useTable('payments', { orderBy: 'payment_date', ascending: false })

  const [customers, setCustomers] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [openSales, setOpenSales] = useState([])       // sales not fully paid
  const [openPurchases, setOpenPurchases] = useState([]) // purchases not fully paid

  const [partyId, setPartyId] = useState('')
  const [targetId, setTargetId] = useState('')   // sale_id or purchase_id being paid down
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    supabase.from('customers').select('id,name').order('name').then(({ data }) => setCustomers(data || []))
    supabase.from('suppliers').select('id,name').order('name').then(({ data }) => setSuppliers(data || []))
  }, [])

  // When the chosen customer/supplier changes, load their open (unpaid/partial) invoices
  useEffect(() => {
    setTargetId('')
    setAmount('')
    if (!partyId) { setOpenSales([]); setOpenPurchases([]); return }

    if (tab === 'customer') {
      supabase.from('sales').select('id,invoice_no,total,amount_paid,payment_status')
        .eq('customer_id', partyId).neq('payment_status', 'paid').order('sale_date', { ascending: false })
        .then(({ data }) => setOpenSales(data || []))
    } else {
      supabase.from('purchases').select('id,reference_no,total,amount_paid,payment_status')
        .eq('supplier_id', partyId).neq('payment_status', 'paid').order('purchase_date', { ascending: false })
        .then(({ data }) => setOpenPurchases(data || []))
    }
  }, [partyId, tab])

  const openList = tab === 'customer' ? openSales : openPurchases
  const selectedTarget = openList.find(t => t.id === targetId)
  const balanceDue = selectedTarget ? Number(selectedTarget.total) - Number(selectedTarget.amount_paid) : 0

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!partyId || !targetId || !amount || Number(amount) <= 0) {
      setError('Pick a customer/supplier, an invoice, and enter an amount.')
      return
    }
    if (Number(amount) > balanceDue) {
      setError(`Amount can't exceed the balance due (${balanceDue.toLocaleString()}).`)
      return
    }

    setBusy(true)
    try {
      const newAmountPaid = Number(selectedTarget.amount_paid) + Number(amount)
      const newStatus = newAmountPaid >= Number(selectedTarget.total) ? 'paid' : 'partial'

      if (tab === 'customer') {
        // 1. Update the sale — this fires sync_customer_balance automatically
        const { error: updErr } = await supabase.from('sales')
          .update({ amount_paid: newAmountPaid, payment_status: newStatus })
          .eq('id', targetId)
        if (updErr) throw updErr

        // 2. Log the payment itself
        const { error: payErr } = await supabase.from('payments').insert({
          payment_type: 'customer_payment',
          customer_id: partyId,
          related_sale_id: targetId,
          amount: Number(amount),
          method,
          reference: reference || null,
          recorded_by: user.id
        })
        if (payErr) throw payErr
      } else {
        const { error: updErr } = await supabase.from('purchases')
          .update({ amount_paid: newAmountPaid, payment_status: newStatus })
          .eq('id', targetId)
        if (updErr) throw updErr

        const { error: payErr } = await supabase.from('payments').insert({
          payment_type: 'supplier_payment',
          supplier_id: partyId,
          related_purchase_id: targetId,
          amount: Number(amount),
          method,
          reference: reference || null,
          recorded_by: user.id
        })
        if (payErr) throw payErr
      }

      setNotice(`Payment of ${Number(amount).toLocaleString()} recorded — status now "${newStatus}".`)
      setTargetId('')
      setAmount('')
      setReference('')
      // refresh the open invoice list for this party
      setPartyId(p => p)
      refreshPayments()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100 mb-6">Payments</h1>

      <div className="flex text-sm border border-line rounded-lg overflow-hidden mb-6 max-w-xs">
        <button
          onClick={() => { setTab('customer'); setPartyId('') }}
          className={`flex-1 py-2 ${tab === 'customer' ? 'bg-surge/10 text-surge' : 'text-slate-400'}`}
        >
          Customer payment
        </button>
        <button
          onClick={() => { setTab('supplier'); setPartyId('') }}
          className={`flex-1 py-2 ${tab === 'supplier' ? 'bg-surge/10 text-surge' : 'text-slate-400'}`}
        >
          Supplier payment
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={submit} className="card p-5 space-y-3">
          <div className="font-medium text-slate-100 mb-1">
            Record {tab === 'customer' ? 'customer' : 'supplier'} payment
          </div>

          <div>
            <label className="label">{tab === 'customer' ? 'Customer' : 'Supplier'}</label>
            <select className="input" value={partyId} onChange={e => setPartyId(e.target.value)} required>
              <option value="">Select…</option>
              {(tab === 'customer' ? customers : suppliers).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {partyId && (
            <div>
              <label className="label">Open invoice</label>
              <select className="input" value={targetId} onChange={e => setTargetId(e.target.value)} required>
                <option value="">Select…</option>
                {openList.map(t => (
                  <option key={t.id} value={t.id}>
                    {tab === 'customer' ? t.invoice_no : t.reference_no} — balance{' '}
                    {(Number(t.total) - Number(t.amount_paid)).toLocaleString()}
                  </option>
                ))}
              </select>
              {partyId && openList.length === 0 && (
                <p className="text-xs text-slate-500 mt-1">No unpaid or partial invoices for this {tab}.</p>
              )}
            </div>
          )}

          {selectedTarget && (
            <div className="text-xs text-slate-400 bg-ink rounded-lg px-3 py-2 border border-line">
              Total: {Number(selectedTarget.total).toLocaleString()} · Already paid: {Number(selectedTarget.amount_paid).toLocaleString()}
              <br />Balance due: <span className="text-volt font-mono">{balanceDue.toLocaleString()}</span>
            </div>
          )}

          <div>
            <label className="label">Amount</label>
            <input type="number" step="0.01" className="input" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>

          <div>
            <label className="label">Method</label>
            <select className="input" value={method} onChange={e => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="airtel_money">Airtel Money</option>
              <option value="tnm_mpamba">TNM Mpamba</option>
            </select>
          </div>

          <div>
            <label className="label">Reference (optional)</label>
            <input className="input" value={reference} onChange={e => setReference(e.target.value)} placeholder="Transaction ID, receipt #…" />
          </div>

          {error && <div className="text-bad text-sm">{error}</div>}
          {notice && <div className="text-good text-sm">{notice}</div>}

          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Recording…' : 'Record payment'}</button>
        </form>

        <div className="card lg:col-span-2 overflow-x-auto">
          <div className="px-4 pt-4 font-medium text-slate-100">Payment history</div>
          {paymentsLoading ? (
            <div className="p-6 text-sm text-slate-500">Loading…</div>
          ) : payments.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No payments recorded yet.</div>
          ) : (
            <table className="table-base mt-2">
              <thead><tr><th>Date</th><th>Type</th><th>Method</th><th>Amount</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="text-slate-400">{new Date(p.payment_date).toLocaleDateString()}</td>
                    <td className="capitalize">{p.payment_type.replace('_', ' ')}</td>
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