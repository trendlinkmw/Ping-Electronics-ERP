import { useState } from 'react'
import { useTable } from '../lib/useTable'
import { useAuth } from '../context/AuthContext'
import BarcodeCameraScanner from '../components/BarcodeCameraScanner'

const empty = { sku: '', barcode: '', name: '', buying_price: '', selling_price: '', quantity: '', min_stock: '5' }

export default function Products() {
  const { rows, loading, error, insert, update } = useTable('products', { orderBy: 'name', ascending: true })
  const { user } = useAuth()
  const [form, setForm] = useState(empty)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [query, setQuery] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)

  const filtered = rows.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) || p.sku.toLowerCase().includes(query.toLowerCase())
  )

  const startEdit = (p) => {
    setEditingId(p.id)
    setForm({
      sku: p.sku, barcode: p.barcode || '', name: p.name,
      buying_price: p.buying_price, selling_price: p.selling_price,
      quantity: p.quantity, min_stock: p.min_stock
    })
  }

  const cancel = () => { setEditingId(null); setForm(empty); setFormError('') }

  const submit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const payload = {
        sku: form.sku.trim(),
        barcode: form.barcode.trim() || null,
        name: form.name.trim(),
        buying_price: Number(form.buying_price) || 0,
        selling_price: Number(form.selling_price) || 0,
        quantity: Number(form.quantity) || 0,
        min_stock: Number(form.min_stock) || 0,
      }
      if (editingId) {
        await update(editingId, payload)
      } else {
        await insert({ ...payload, created_by: user.id })
      }
      cancel()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-100">Products</h1>
        <input
          className="input max-w-xs"
          placeholder="Search by name or SKU…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={submit} className="card p-5 h-fit space-y-3 lg:col-span-1">
          <div className="font-medium text-slate-100 mb-1">{editingId ? 'Edit product' : 'Add product'}</div>

          <div>
            <label className="label">SKU</label>
            <input className="input" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Barcode (optional)</label>
            <div className="flex gap-2">
              <input
                className="input font-mono"
                value={form.barcode}
                onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                placeholder="Scan or type — used by POS scanning"
              />
              <button type="button" onClick={() => setCameraOpen(true)} className="btn-ghost shrink-0" title="Scan barcode with camera">
                📷
              </button>
            </div>
          </div>
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Buying price</label>
              <input type="number" step="0.01" className="input" value={form.buying_price} onChange={e => setForm(f => ({ ...f, buying_price: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Selling price</label>
              <input type="number" step="0.01" className="input" value={form.selling_price} onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantity{editingId ? '' : ' on hand'}</label>
              <input type="number" step="0.01" className="input" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Min stock</label>
              <input type="number" step="0.01" className="input" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} required />
            </div>
          </div>

          {editingId && (
            <p className="text-xs text-slate-500">
              Editing quantity here overwrites stock directly. Prefer recording a Sale or Purchase so the stock
              movement audit trail stays accurate — use this only for corrections.
            </p>
          )}

          {formError && <div className="text-bad text-sm">{formError}</div>}

          <div className="flex gap-2 pt-1">
            <button className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add product'}</button>
            {editingId && <button type="button" onClick={cancel} className="btn-ghost">Cancel</button>}
          </div>
        </form>

        <div className="card lg:col-span-2 overflow-x-auto">
          {error && <div className="text-bad text-sm p-4">{error}</div>}
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading products…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No products yet. Add your first one on the left.</div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>SKU</th><th>Barcode</th><th>Name</th><th>Stock</th><th>Sell price</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const low = Number(p.quantity) <= Number(p.min_stock)
                  return (
                    <tr key={p.id}>
                      <td className="font-mono text-xs text-slate-400">{p.sku}</td>
                      <td className="font-mono text-xs text-slate-500">{p.barcode || '—'}</td>
                      <td>{p.name}</td>
                      <td className={low ? 'text-volt font-medium' : ''}>{p.quantity}{low && ' ⚠'}</td>
                      <td className="font-mono">{Number(p.selling_price).toLocaleString()}</td>
                      <td>
                        <button onClick={() => startEdit(p)} className="text-surge text-xs hover:underline">Edit</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {cameraOpen && (
        <BarcodeCameraScanner
          onDetected={(code) => {
            setForm(f => ({ ...f, barcode: code }))
            setCameraOpen(false)
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  )
}