import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

const TYPES = [
  { value: 'adjustment', label: 'Correction (recount)', lockedDirection: null },
  { value: 'damaged', label: 'Damaged / lost', lockedDirection: 'decrease' },
  { value: 'return_in', label: 'Return from customer', lockedDirection: 'increase' },
  { value: 'return_out', label: 'Return to supplier', lockedDirection: 'decrease' },
]

export default function StockAdjustment() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [loadingMovements, setLoadingMovements] = useState(true)

  const [productId, setProductId] = useState('')
  const [type, setType] = useState('adjustment')
  const [direction, setDirection] = useState('increase')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadProducts = () =>
    supabase.from('products').select('id,name,sku,quantity').order('name').then(({ data }) => setProducts(data || []))

  const loadMovements = () => {
    setLoadingMovements(true)
    supabase
      .from('stock_movements')
      .select('id, movement_type, quantity, reason, created_at, product:products(name)')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setMovements(data || [])
        setLoadingMovements(false)
      })
  }

  useEffect(() => { loadProducts(); loadMovements() }, [])

  const selectedType = TYPES.find(t => t.value === type)
  const effectiveDirection = selectedType.lockedDirection || direction
  const selectedProduct = products.find(p => p.id === productId)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    const qty = Number(quantity)
    if (!productId || !qty || qty <= 0 || !reason.trim()) {
      setError('Pick a product, enter a positive quantity, and give a reason.')
      return
    }

    setBusy(true)
    try {
      const delta = effectiveDirection === 'increase' ? qty : -qty
      const newQuantity = Number(selectedProduct.quantity) + delta
      if (newQuantity < 0) {
        setError(`That would take stock below zero (currently ${selectedProduct.quantity}).`)
        setBusy(false)
        return
      }

      const { error: updErr } = await supabase.from('products')
        .update({ quantity: newQuantity })
        .eq('id', productId)
      if (updErr) throw updErr

      const { error: movErr } = await supabase.from('stock_movements').insert({
        product_id: productId,
        movement_type: type,
        quantity: qty,
        reason: reason.trim(),
        created_by: user.id
      })
      if (movErr) throw movErr

      setNotice(`${selectedProduct.name}: ${effectiveDirection === 'increase' ? '+' : '-'}${qty} → now ${newQuantity} in stock.`)
      setQuantity('')
      setReason('')
      loadProducts()
      loadMovements()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100 mb-1">Stock Adjustment</h1>
      <p className="text-sm text-slate-500 mb-6">
        Use this for corrections, damage, or returns — it keeps a proper record instead of just editing the
        number on the Products page.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={submit} className="card p-5 space-y-3">
          <div>
            <label className="label">Product</label>
            <select className="input" value={productId} onChange={e => setProductId(e.target.value)} required>
              <option value="">Select…</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.quantity} in stock</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Type</label>
            <select className="input" value={type} onChange={e => setType(e.target.value)}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {selectedType.lockedDirection === null && (
            <div>
              <label className="label">Direction</label>
              <div className="flex text-sm border border-line rounded-lg overflow-hidden">
                <button type="button" onClick={() => setDirection('increase')}
                  className={`flex-1 py-2 ${direction === 'increase' ? 'bg-good/10 text-good' : 'text-slate-400'}`}>
                  + Increase
                </button>
                <button type="button" onClick={() => setDirection('decrease')}
                  className={`flex-1 py-2 ${direction === 'decrease' ? 'bg-bad/10 text-bad' : 'text-slate-400'}`}>
                  − Decrease
                </button>
              </div>
            </div>
          )}
          {selectedType.lockedDirection && (
            <div className="text-xs text-slate-500">
              This type always {selectedType.lockedDirection === 'increase' ? 'increases' : 'decreases'} stock.
            </div>
          )}

          <div>
            <label className="label">Quantity</label>
            <input type="number" min="1" step="1" className="input" value={quantity} onChange={e => setQuantity(e.target.value)} required />
          </div>

          <div>
            <label className="label">Reason</label>
            <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. physical count, broken in transit…" required />
          </div>

          {selectedProduct && quantity && (
            <div className="text-xs text-slate-400 bg-ink rounded-lg px-3 py-2 border border-line">
              {selectedProduct.quantity} {effectiveDirection === 'increase' ? '+' : '-'} {quantity || 0} ={' '}
              <span className={effectiveDirection === 'increase' ? 'text-good' : 'text-bad'}>
                {Number(selectedProduct.quantity) + (effectiveDirection === 'increase' ? Number(quantity || 0) : -Number(quantity || 0))}
              </span>
            </div>
          )}

          {error && <div className="text-bad text-sm">{error}</div>}
          {notice && <div className="text-good text-sm">{notice}</div>}

          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Apply adjustment'}</button>
        </form>

        <div className="card lg:col-span-2 overflow-x-auto">
          <div className="px-4 pt-4 font-medium text-slate-100">Recent movements</div>
          {loadingMovements ? (
            <div className="p-6 text-sm text-slate-500">Loading…</div>
          ) : movements.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No manual adjustments logged yet.</div>
          ) : (
            <table className="table-base mt-2">
              <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Reason</th></tr></thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id}>
                    <td className="text-slate-400">{new Date(m.created_at).toLocaleDateString()}</td>
                    <td>{m.product?.name || '—'}</td>
                    <td className="capitalize text-slate-400">{m.movement_type.replace('_', ' ')}</td>
                    <td className="font-mono">{m.quantity}</td>
                    <td className="text-slate-400">{m.reason || '—'}</td>
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