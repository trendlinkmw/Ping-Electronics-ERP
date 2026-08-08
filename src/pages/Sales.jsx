import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import BarcodeCameraScanner from '../components/BarcodeCameraScanner'

function genInvoiceNo() {
  const d = new Date()
  const stamp = d.toISOString().replace(/[-:T.]/g, '').slice(0, 14)
  return `INV-${stamp}`
}

export default function Sales() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [cart, setCart] = useState([]) // { product_id, name, price, qty, available }
  const [customerId, setCustomerId] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [discount, setDiscount] = useState('0')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lastInvoice, setLastInvoice] = useState(null)
  const [onCredit, setOnCredit] = useState(false)
  const [barcode, setBarcode] = useState('')
  const [scanNotice, setScanNotice] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const barcodeRef = useRef(null)

  useEffect(() => {
    supabase.from('products').select('id,name,selling_price,quantity,barcode').eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data || []))
    supabase.from('customers').select('id,name').order('name')
      .then(({ data }) => setCustomers(data || []))
    barcodeRef.current?.focus()
  }, [])

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  const addToCart = (p) => {
    setCart(c => {
      const existing = c.find(i => i.product_id === p.id)
      if (existing) {
        if (existing.qty >= p.quantity) return c
        return c.map(i => i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i)
      }
      if (p.quantity <= 0) return c
      return [...c, { product_id: p.id, name: p.name, price: Number(p.selling_price), qty: 1, available: Number(p.quantity) }]
    })
  }

  const setQty = (productId, qty) => {
    setCart(c => c.map(i => i.product_id === productId ? { ...i, qty: Math.max(1, Math.min(qty, i.available)) } : i))
  }

  const removeFromCart = (productId) => setCart(c => c.filter(i => i.product_id !== productId))

  const lookupAndAddByBarcode = useCallback((code) => {
    const trimmed = code.trim()
    if (!trimmed) return
    setProducts(current => {
      const match = current.find(p => p.barcode && p.barcode === trimmed)
      if (match) {
        addToCart(match)
        setScanNotice(`Added: ${match.name}`)
      } else {
        setScanNotice(`No product found for barcode "${trimmed}"`)
      }
      return current
    })
  }, [])

  const handleBarcodeKeyDown = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const code = barcode
    setBarcode('')
    lookupAndAddByBarcode(code)
    barcodeRef.current?.focus()
  }

  const handleCameraDetected = useCallback((code) => {
    lookupAndAddByBarcode(code)
    setCameraOpen(false)
  }, [lookupAndAddByBarcode])

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discountVal = Number(discount) || 0
  const total = Math.max(0, subtotal - discountVal)

  const checkout = async () => {
    if (cart.length === 0) return
    if (customerId === '__new__' && !newCustomerName.trim()) {
      setError('Enter the new customer\'s name, or switch back to Walk-in customer.')
      return
    }
    if (onCredit && (!customerId || customerId === '')) {
      setError('Pick a real customer before selling on credit — credit can\'t go to a walk-in sale.')
      return
    }
    setBusy(true)
    setError('')
    try {
      let finalCustomerId = customerId || null

      if (customerId === '__new__') {
        const { data: newCustomer, error: custErr } = await supabase.from('customers').insert({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
          created_by: user.id
        }).select().single()
        if (custErr) throw custErr
        finalCustomerId = newCustomer.id
      }

      const invoice_no = genInvoiceNo()
      const { data: sale, error: saleErr } = await supabase.from('sales').insert({
        invoice_no,
        customer_id: finalCustomerId,
        sold_by: user.id,
        subtotal,
        discount: discountVal,
        total,
        amount_paid: onCredit ? 0 : total,
        payment_method: onCredit ? null : paymentMethod,
        payment_status: onCredit ? 'unpaid' : 'paid'
      }).select().single()
      if (saleErr) throw saleErr

      const items = cart.map(i => ({
        sale_id: sale.id,
        product_id: i.product_id,
        quantity: i.qty,
        unit_price: i.price,
        subtotal: i.price * i.qty
      }))
      const { error: itemsErr } = await supabase.from('sale_items').insert(items)
      if (itemsErr) throw itemsErr

      setLastInvoice({ id: sale.id, invoice_no, total })
      setCart([])
      setDiscount('0')
      setCustomerId('')
      setNewCustomerName('')
      setNewCustomerPhone('')
      setOnCredit(false)
      setScanNotice('')
      const { data: refreshed } = await supabase.from('products').select('id,name,selling_price,quantity,barcode').eq('is_active', true).order('name')
      setProducts(refreshed || [])
      const { data: refreshedCustomers } = await supabase.from('customers').select('id,name').order('name')
      setCustomers(refreshedCustomers || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100 mb-6">Sales / POS</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <div className="mb-3">
            <label className="label">Scan barcode</label>
            <div className="flex gap-2">
              <input
                ref={barcodeRef}
                className="input font-mono"
                placeholder="Click here, then scan — or type a barcode and press Enter"
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                autoFocus
              />
              <button type="button" onClick={() => setCameraOpen(true)} className="btn-ghost shrink-0" title="Scan with phone/webcam camera">
                📷 Camera
              </button>
            </div>
            {scanNotice && <div className="text-xs text-slate-400 mt-1">{scanNotice}</div>}
          </div>

          <input
            className="input mb-4"
            placeholder="Or search products by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.quantity <= 0}
                className="card p-3 text-left hover:border-surge/60 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <div className="text-sm text-slate-100 font-medium truncate">{p.name}</div>
                <div className="text-xs text-slate-500 mt-1">Stock: {p.quantity}</div>
                <div className="text-surge font-mono text-sm mt-1">{Number(p.selling_price).toLocaleString()}</div>
              </button>
            ))}
            {filtered.length === 0 && <div className="text-sm text-slate-500 col-span-full">No products match.</div>}
          </div>
        </div>

        <div className="card p-5 flex flex-col">
          <div className="font-medium text-slate-100 mb-3">Cart</div>

          <div className="flex-1 overflow-y-auto space-y-2 mb-3 max-h-[40vh]">
            {cart.length === 0 && <div className="text-sm text-slate-500">Tap a product to add it.</div>}
            {cart.map(i => (
              <div key={i.product_id} className="flex items-center justify-between text-sm gap-2">
                <div className="flex-1 min-w-0">
                  <div className="truncate text-slate-200">{i.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{i.price.toLocaleString()} each</div>
                </div>
                <input
                  type="number"
                  min={1}
                  max={i.available}
                  value={i.qty}
                  onChange={e => setQty(i.product_id, Number(e.target.value))}
                  className="input w-16 text-center px-1 py-1"
                />
                <button onClick={() => removeFromCart(i.product_id)} className="text-bad text-xs">✕</button>
              </div>
            ))}
          </div>

          <div className="border-t border-line pt-3 space-y-2">
            <div>
              <label className="label">Customer (optional)</label>
              <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                <option value="">Walk-in customer</option>
                <option value="__new__">+ New customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {customerId === '__new__' && (
              <div className="grid grid-cols-2 gap-2 bg-ink rounded-lg p-3 border border-line">
                <div className="col-span-2">
                  <label className="label">Customer name</label>
                  <input
                    className="input"
                    value={newCustomerName}
                    onChange={e => setNewCustomerName(e.target.value)}
                    placeholder="Full name"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Phone (optional)</label>
                  <input
                    className="input"
                    value={newCustomerPhone}
                    onChange={e => setNewCustomerPhone(e.target.value)}
                    placeholder="e.g. 099…"
                  />
                </div>
                <p className="col-span-2 text-xs text-slate-500">
                  Saved as a new customer automatically when you complete this sale.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Payment</label>
                <select
                  className="input disabled:opacity-40"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  disabled={onCredit}
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="airtel_money">Airtel Money</option>
                  <option value="tnm_mpamba">TNM Mpamba</option>
                </select>
              </div>
              <div>
                <label className="label">Discount</label>
                <input type="number" className="input" value={discount} onChange={e => setDiscount(e.target.value)} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300 pt-1">
              <input
                type="checkbox"
                checked={onCredit}
                onChange={e => setOnCredit(e.target.checked)}
                className="accent-surge"
              />
              Sell on credit (pay later — requires a customer, not walk-in)
            </label>

            <div className="flex justify-between text-sm text-slate-400 pt-1">
              <span>Subtotal</span><span className="font-mono">{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold text-slate-100">
              <span>Total</span><span className="font-mono text-surge">MWK {total.toLocaleString()}</span>
            </div>

            {error && <div className="text-bad text-sm">{error}</div>}
            {lastInvoice && (
              <div className="text-good text-xs flex items-center justify-between">
                <span>Sale {lastInvoice.invoice_no} — MWK {lastInvoice.total.toLocaleString()}</span>
                <Link to={`/receipt/${lastInvoice.id}`} className="text-surge hover:underline">View receipt →</Link>
              </div>
            )}

            <button onClick={checkout} disabled={busy || cart.length === 0} className="btn-primary w-full mt-2">
              {busy ? 'Processing…' : onCredit ? 'Complete sale (on credit)' : 'Complete sale'}
            </button>
          </div>
        </div>
      </div>

      {cameraOpen && (
        <BarcodeCameraScanner
          onDetected={handleCameraDetected}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  )
}