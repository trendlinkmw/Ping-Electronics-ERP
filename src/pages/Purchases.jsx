import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useTable } from '../lib/useTable'

function genRefNo() {
  const d = new Date()
  const stamp = d.toISOString().replace(/[-:T.]/g, '').slice(0, 14)
  return `PO-${stamp}`
}

export default function Purchases() {
  const { user } = useAuth()
  const { rows: purchases, loading, refresh } = useTable('purchases', { orderBy: 'purchase_date', ascending: false })
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [lines, setLines] = useState([{ product_id: '', quantity: 1, unit_cost: 0 }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('suppliers').select('id,name').order('name').then(({ data }) => setSuppliers(data || []))
    supabase.from('products').select('id,name,buying_price').order('name').then(({ data }) => setProducts(data || []))
  }, [])

  const updateLine = (idx, patch) => setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l))
  const addLine = () => setLines(ls => [...ls, { product_id: '', quantity: 1, unit_cost: 0 }])
  const removeLine = (idx) => setLines(ls => ls.filter((_, i) => i !== idx))

  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const validLines = lines.filter(l => l.product_id && Number(l.quantity) > 0)
    if (!supplierId || validLines.length === 0) {
      setError('Pick a supplier and at least one product line.')
      return
    }
    setBusy(true)
    try {
      const reference_no = genRefNo()
      const { data: purchase, error: pErr } = await supabase.from('purchases').insert({
        reference_no,
        supplier_id: supplierId,
        purchased_by: user.id,
        total,
        amount_paid: 0,
        payment_status: 'unpaid'
      }).select().single()
      if (pErr) throw pErr

      const items = validLines.map(l => ({
        purchase_id: purchase.id,
        product_id: l.product_id,
        quantity: Number(l.quantity),
        unit_cost: Number(l.unit_cost),
        subtotal: Number(l.quantity) * Number(l.unit_cost)
      }))
      const { error: iErr } = await supabase.from('purchase_items').insert(items)
      if (iErr) throw iErr

      setSupplierId('')
      setLines([{ product_id: '', quantity: 1, unit_cost: 0 }])
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100 mb-6">Purchases</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={submit} className="card p-5 lg:col-span-2 space-y-4">
          <div className="font-medium text-slate-100">New purchase order</div>

          <div>
            <label className="label">Supplier</label>
            <select className="input" value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
              <option value="">Select supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            {lines.map((l, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="label">Product</label>
                  <select className="input" value={l.product_id} onChange={e => updateLine(idx, { product_id: e.target.value })}>
                    <option value="">Select…</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="w-24">
                  <label className="label">Qty</label>
                  <input type="number" min={1} className="input" value={l.quantity} onChange={e => updateLine(idx, { quantity: e.target.value })} />
                </div>
                <div className="w-32">
                  <label className="label">Unit cost</label>
                  <input type="number" step="0.01" className="input" value={l.unit_cost} onChange={e => updateLine(idx, { unit_cost: e.target.value })} />
                </div>
                <button type="button" onClick={() => removeLine(idx)} className="text-bad text-xs pb-2">✕</button>
              </div>
            ))}
            <button type="button" onClick={addLine} className="text-surge text-xs hover:underline">+ Add line</button>
          </div>

          <div className="flex justify-between text-lg font-semibold text-slate-100 border-t border-line pt-3">
            <span>Total</span><span className="font-mono text-surge">MWK {total.toLocaleString()}</span>
          </div>

          {error && <div className="text-bad text-sm">{error}</div>}

          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Recording…' : 'Record purchase (stock in)'}</button>
        </form>

        <div className="card overflow-x-auto">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading…</div>
          ) : purchases.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No purchases yet.</div>
          ) : (
            <table className="table-base">
              <thead><tr><th>Ref</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.reference_no}</td>
                    <td className="font-mono">{Number(p.total).toLocaleString()}</td>
                    <td className={p.payment_status === 'paid' ? 'text-good' : 'text-volt'}>{p.payment_status}</td>
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
