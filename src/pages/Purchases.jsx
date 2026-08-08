import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

function genRefNo() {
  const d = new Date()
  const stamp = d.toISOString().replace(/[-:T.]/g, '').slice(0, 14)
  return `PO-${stamp}`
}

const emptyLine = { product_id: '', quantity: 1, unit_cost: 0, newSku: '', newName: '', newSellingPrice: '' }

export default function Purchases() {
  const { user } = useAuth()
  const [purchases, setPurchases] = useState([])
  const [loadingPurchases, setLoadingPurchases] = useState(true)
  const [search, setSearch] = useState('')

  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierPhone, setNewSupplierPhone] = useState('')
  const [lines, setLines] = useState([{ ...emptyLine }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadRefData = async () => {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('suppliers').select('id,name').order('name'),
      supabase.from('products').select('id,name,buying_price').order('name'),
    ])
    setSuppliers(s || [])
    setProducts(p || [])
  }

  const loadPurchases = async () => {
    setLoadingPurchases(true)
    const { data } = await supabase
      .from('purchases')
      .select('id, reference_no, purchase_date, total, payment_status, supplier:suppliers(id, name)')
      .order('purchase_date', { ascending: false })
      .limit(100)
    setPurchases(data || [])
    setLoadingPurchases(false)
  }

  useEffect(() => { loadRefData(); loadPurchases() }, [])

  const updateLine = (idx, patch) => setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l))
  const addLine = () => setLines(ls => [...ls, { ...emptyLine }])
  const removeLine = (idx) => setLines(ls => ls.filter((_, i) => i !== idx))

  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0)

  const filteredPurchases = purchases.filter(p =>
    p.reference_no.toLowerCase().includes(search.toLowerCase()) ||
    (p.supplier?.name || '').toLowerCase().includes(search.toLowerCase())
  )

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    if (supplierId === '__new__' && !newSupplierName.trim()) {
      setError('Enter the new supplier\'s name, or pick an existing one.')
      return
    }
    const validLines = lines.filter(l =>
      (l.product_id && l.product_id !== '__new__' && Number(l.quantity) > 0) ||
      (l.product_id === '__new__' && l.newName.trim() && Number(l.quantity) > 0)
    )
    if ((!supplierId) || validLines.length === 0) {
      setError('Pick a supplier and at least one complete product line.')
      return
    }

    setBusy(true)
    try {
      let finalSupplierId = supplierId
      if (supplierId === '__new__') {
        const { data: newSupplier, error: supErr } = await supabase.from('suppliers').insert({
          name: newSupplierName.trim(),
          phone: newSupplierPhone.trim() || null,
          created_by: user.id
        }).select().single()
        if (supErr) throw supErr
        finalSupplierId = newSupplier.id
      }

      const reference_no = genRefNo()
      const { data: purchase, error: pErr } = await supabase.from('purchases').insert({
        reference_no,
        supplier_id: finalSupplierId,
        purchased_by: user.id,
        total,
        amount_paid: 0,
        payment_status: 'unpaid'
      }).select().single()
      if (pErr) throw pErr

      const items = []
      for (const l of validLines) {
        let productId = l.product_id
        if (productId === '__new__') {
          const { data: newProduct, error: prodErr } = await supabase.from('products').insert({
            sku: l.newSku.trim() || `SKU-${Date.now()}`,
            name: l.newName.trim(),
            buying_price: Number(l.unit_cost) || 0,
            selling_price: Number(l.newSellingPrice) || 0,
            quantity: 0,
            min_stock: 5,
            created_by: user.id
          }).select().single()
          if (prodErr) throw prodErr
          productId = newProduct.id
        }
        items.push({
          purchase_id: purchase.id,
          product_id: productId,
          quantity: Number(l.quantity),
          unit_cost: Number(l.unit_cost),
          subtotal: Number(l.quantity) * Number(l.unit_cost)
        })
      }
      const { error: iErr } = await supabase.from('purchase_items').insert(items)
      if (iErr) throw iErr

      setSupplierId('')
      setNewSupplierName('')
      setNewSupplierPhone('')
      setLines([{ ...emptyLine }])
      loadPurchases()
      loadRefData()
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
              <option value="__new__">+ New supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {supplierId === '__new__' && (
            <div className="grid grid-cols-2 gap-2 bg-ink rounded-lg p-3 border border-line">
              <div>
                <label className="label">Supplier name</label>
                <input className="input" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} required />
              </div>
              <div>
                <label className="label">Phone (optional)</label>
                <input className="input" value={newSupplierPhone} onChange={e => setNewSupplierPhone(e.target.value)} />
              </div>
              <p className="col-span-2 text-xs text-slate-500">Saved automatically when you submit this order.</p>
            </div>
          )}

          <div className="space-y-3">
            {lines.map((l, idx) => (
              <div key={idx} className="border border-line rounded-lg p-3 space-y-2">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="label">Product</label>
                    <select
                      className="input"
                      value={l.product_id}
                      onChange={e => {
                        const val = e.target.value
                        const prod = products.find(p => p.id === val)
                        updateLine(idx, { product_id: val, unit_cost: prod ? prod.buying_price : l.unit_cost })
                      }}
                    >
                      <option value="">Select…</option>
                      <option value="__new__">+ New product…</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="label">Qty</label>
                    <input type="number" min={1} className="input" value={l.quantity} onChange={e => updateLine(idx, { quantity: e.target.value })} />
                  </div>
                  <div className="w-28">
                    <label className="label">Unit cost</label>
                    <input type="number" step="0.01" className="input" value={l.unit_cost} onChange={e => updateLine(idx, { unit_cost: e.target.value })} />
                  </div>
                  <button type="button" onClick={() => removeLine(idx)} className="text-bad text-xs pb-2">✕</button>
                </div>

                {l.product_id === '__new__' && (
                  <div className="grid grid-cols-2 gap-2 bg-ink rounded-lg p-2 border border-line">
                    <div>
                      <label className="label">SKU (optional)</label>
                      <input className="input" value={l.newSku} onChange={e => updateLine(idx, { newSku: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Product name</label>
                      <input className="input" value={l.newName} onChange={e => updateLine(idx, { newName: e.target.value })} required />
                    </div>
                    <div className="col-span-2">
                      <label className="label">Selling price (once in stock)</label>
                      <input type="number" step="0.01" className="input" value={l.newSellingPrice} onChange={e => updateLine(idx, { newSellingPrice: e.target.value })} />
                    </div>
                  </div>
                )}
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
          <div className="p-4 border-b border-line">
            <input className="input" placeholder="Search reference or supplier…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {loadingPurchases ? (
            <div className="p-6 text-sm text-slate-500">Loading…</div>
          ) : filteredPurchases.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No purchases match.</div>
          ) : (
            <table className="table-base">
              <thead><tr><th>Ref</th><th>Supplier</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {filteredPurchases.map(p => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.reference_no}</td>
                    <td>
                      {p.supplier ? (
                        <Link to={`/suppliers/${p.supplier.id}`} className="text-surge hover:underline">{p.supplier.name}</Link>
                      ) : '—'}
                    </td>
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