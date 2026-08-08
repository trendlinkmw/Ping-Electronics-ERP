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
  const [expandedId, setExpandedId] = useState('')
  const [expandedItems, setExpandedItems] = useState({})
  const [loadingItemsFor, setLoadingItemsFor] = useState('')

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
      .select('id, reference_no, purchase_date, total, payment_status, supplier:suppliers(id, name), purchasedBy:profiles!purchased_by(full_name)')
      .order('purchase_date', { ascending: false })
      .limit(100)
    setPurchases(data || [])
    setLoadingPurchases(false)
  }

  useEffect(() => { loadRefData(); loadPurchases() }, [])

  const toggleExpand = async (purchaseId) => {
    if (expandedId === purchaseId) {
      setExpandedId('')
      return
    }
    setExpandedId(purchaseId)
    if (!expandedItems[purchaseId]) {
      setLoadingItemsFor(purchaseId)
      const { data } = await supabase
        .from('purchase_items')
        .select('quantity, unit_cost, subtotal, product:products(name, sku)')
        .eq('purchase_id', purchaseId)
      setExpandedItems(prev => ({ ...prev, [purchaseId]: data || [] }))
      setLoadingItemsFor('')
    }
  }

  const updateLine = (idx, patch) => setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l))
  const addLine = () => setLines(ls => [...ls, { ...emptyLine }])
  const removeLine = (idx) => setLines(ls => ls.filter((_, i) => i !== idx))

  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0)

  const filteredPurchases = purchases.filter(p =>
    p.reference_no.toLowerCase().includes(search.toLowerCase()) ||
    (p.supplier?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.purchasedBy?.full_name || '').toLowerCase().includes(search.toLowerCase())
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
            <input className="input" placeholder="Search reference, supplier, or buyer…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {loadingPurchases ? (
            <div className="p-6 text-sm text-slate-500">Loading…</div>
          ) : filteredPurchases.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No purchases match.</div>
          ) : (
            <div className="divide-y divide-line/60">
              {filteredPurchases.map(p => (
                <div key={p.id}>
                  <button
                    onClick={() => toggleExpand(p.id)}
                    className="w-full text-left px-3 py-2 hover:bg-white/[0.02] transition text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-slate-300">{p.reference_no}</span>
                      <span className={`text-xs capitalize ${p.payment_status === 'paid' ? 'text-good' : 'text-volt'}`}>{p.payment_status}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs text-slate-400">
                      <span>
                        {p.supplier?.name || '—'} · bought by {p.purchasedBy?.full_name || '—'}
                      </span>
                      <span className="font-mono text-slate-200">{Number(p.total).toLocaleString()}</span>
                    </div>
                  </button>

                  {expandedId === p.id && (
                    <div className="px-3 pb-3 bg-ink/40">
                      {loadingItemsFor === p.id ? (
                        <div className="text-xs text-slate-500 py-2">Loading items…</div>
                      ) : (expandedItems[p.id] || []).length === 0 ? (
                        <div className="text-xs text-slate-500 py-2">No line items found.</div>
                      ) : (
                        <table className="table-base mt-1">
                          <thead><tr><th>Product</th><th>Qty</th><th>Unit cost</th><th>Subtotal</th></tr></thead>
                          <tbody>
                            {expandedItems[p.id].map((it, i) => (
                              <tr key={i}>
                                <td>{it.product?.name || 'Unknown'}</td>
                                <td className="font-mono">{it.quantity}</td>
                                <td className="font-mono">{Number(it.unit_cost).toLocaleString()}</td>
                                <td className="font-mono">{Number(it.subtotal).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {p.supplier && (
                        <Link to={`/suppliers/${p.supplier.id}`} className="text-surge text-xs hover:underline block mt-2">
                          View supplier profile →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}