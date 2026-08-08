import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { supabase } from '../supabaseClient'
import logo from '../assets/logo.png'

async function buildPdfBlob(node) {
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' })
  const imgData = canvas.toDataURL('image/png')
  const pxToMm = (px) => px * 0.264583
  const widthMm = pxToMm(canvas.width / 2)
  const heightMm = pxToMm(canvas.height / 2)
  const pdf = new jsPDF({ unit: 'mm', format: [widthMm, heightMm] })
  pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm)
  return pdf.output('blob')
}

export default function Receipt() {
  const { saleId } = useParams()
  const receiptRef = useRef(null)
  const [company, setCompany] = useState(null)
  const [sale, setSale] = useState(null)
  const [items, setItems] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [cashierName, setCashierName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [working, setWorking] = useState('') // '' | 'pdf' | 'whatsapp'

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const { data: saleRow, error: saleErr } = await supabase
          .from('sales').select('*').eq('id', saleId).single()
        if (saleErr) throw saleErr
        setSale(saleRow)

        const [{ data: companyRow }, { data: itemRows }, cashierRes, customerRes] = await Promise.all([
          supabase.from('companies').select('*').order('created_at').limit(1).single(),
          supabase.from('sale_items').select('quantity, unit_price, subtotal, product:products(name)').eq('sale_id', saleId),
          supabase.from('profiles').select('full_name').eq('id', saleRow.sold_by).single(),
          saleRow.customer_id
            ? supabase.from('customers').select('name').eq('id', saleRow.customer_id).single()
            : Promise.resolve({ data: null }),
        ])

        setCompany(companyRow)
        setItems(itemRows || [])
        setCashierName(cashierRes.data?.full_name || '—')
        setCustomerName(customerRes.data?.name || 'Walk-in customer')
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [saleId])

  const filename = sale ? `receipt-${sale.invoice_no}.pdf` : 'receipt.pdf'

  const downloadPdf = async () => {
    setWorking('pdf')
    try {
      const blob = await buildPdfBlob(receiptRef.current)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Could not generate PDF: ' + err.message)
    } finally {
      setWorking('')
    }
  }

  const shareToWhatsApp = async () => {
    setWorking('whatsapp')
    try {
      const blob = await buildPdfBlob(receiptRef.current)
      const file = new File([blob], filename, { type: 'application/pdf' })
      const shareText = `Receipt ${sale.invoice_no} — ${company?.name || 'Ping Electronics'} — Total: ${company?.currency || 'MWK'} ${Number(sale.total).toLocaleString()}`

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // Mobile: opens the native share sheet with the PDF attached — pick WhatsApp there
        await navigator.share({ files: [file], title: filename, text: shareText })
      } else {
        // Desktop fallback: WhatsApp Web only accepts text via link, not files —
        // so download the PDF and open WhatsApp with a pre-filled message to attach it manually.
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' (PDF downloaded — attach it in the chat)')}`, '_blank')
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError('Could not share: ' + err.message)
    } finally {
      setWorking('')
    }
  }

  if (loading) return <div className="min-h-screen bg-ink flex items-center justify-center text-sm text-slate-500">Loading receipt…</div>
  if (error && !sale) return <div className="min-h-screen bg-ink flex items-center justify-center text-sm text-bad">{error}</div>
  if (!sale) return <div className="min-h-screen bg-ink flex items-center justify-center text-sm text-bad">Receipt not found.</div>

  const qrData = `TrendLink Receipt\n${sale.invoice_no}\nTotal: ${company?.currency || 'MWK'} ${Number(sale.total).toLocaleString()}\n${company?.name || ''}`

  return (
    <div className="min-h-screen bg-slate-800 flex flex-col items-center py-8 px-4">
      <div className="no-print w-full max-w-sm flex flex-col gap-2 mb-4">
        <div className="flex justify-between">
          <Link to="/history" className="btn-ghost text-sm">← Back</Link>
          <button onClick={() => window.print()} className="btn-ghost text-sm">🖨 Print</button>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadPdf} disabled={working !== ''} className="btn-primary text-sm flex-1">
            {working === 'pdf' ? 'Generating…' : '⬇ Download PDF'}
          </button>
          <button onClick={shareToWhatsApp} disabled={working !== ''} className="btn-primary text-sm flex-1 !bg-good !text-ink">
            {working === 'whatsapp' ? 'Preparing…' : '💬 Share to WhatsApp'}
          </button>
        </div>
        {error && <div className="text-bad text-xs">{error}</div>}
      </div>

      <div ref={receiptRef} id="receipt-print" className="bg-white text-black w-full max-w-sm p-5 font-mono text-xs leading-snug rounded shadow-lg">
        <div className="flex flex-col items-center text-center mb-3">
          <img src={logo} alt="logo" className="w-14 h-14 object-contain mb-2" />
          <div className="font-bold text-sm">{company?.name || 'Ping Electronics'}</div>
          {company?.address && <div>{company.address}</div>}
          {company?.phone && <div>Tel: {company.phone}</div>}
          {company?.email && <div>{company.email}</div>}
        </div>

        <div className="border-t border-dashed border-black my-2" />

        {company?.receipt_header && (
          <>
            <div className="text-center italic mb-2">{company.receipt_header}</div>
            <div className="border-t border-dashed border-black my-2" />
          </>
        )}

        <div className="flex justify-between"><span>Receipt No.</span><span>{sale.invoice_no}</span></div>
        <div className="flex justify-between"><span>Date</span><span>{new Date(sale.sale_date).toLocaleString()}</span></div>
        <div className="flex justify-between"><span>Cashier</span><span>{cashierName}</span></div>
        <div className="flex justify-between"><span>Customer</span><span>{customerName}</span></div>
        <div className="flex justify-between">
          <span>Payment</span>
          <span className="capitalize">{sale.payment_status === 'unpaid' ? 'On credit' : (sale.payment_method || '—').replace('_', ' ')}</span>
        </div>

        <div className="border-t border-dashed border-black my-2" />

        <table className="w-full">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left pb-1">Item</th>
              <th className="text-right pb-1">Qty</th>
              <th className="text-right pb-1">Amt</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td className="py-0.5 pr-1">{it.product?.name || 'Item'}</td>
                <td className="text-right py-0.5">{it.quantity}</td>
                <td className="text-right py-0.5">{Number(it.subtotal).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-black my-2" />

        <div className="flex justify-between"><span>Subtotal</span><span>{Number(sale.subtotal).toLocaleString()}</span></div>
        {Number(sale.discount) > 0 && (
          <div className="flex justify-between"><span>Discount</span><span>-{Number(sale.discount).toLocaleString()}</span></div>
        )}
        <div className="flex justify-between font-bold text-sm mt-1">
          <span>TOTAL</span><span>{company?.currency || 'MWK'} {Number(sale.total).toLocaleString()}</span>
        </div>

        <div className="border-t border-dashed border-black my-2" />

        <div className="flex flex-col items-center mt-3">
          <QRCodeCanvas value={qrData} size={100} />
        </div>

        {company?.receipt_footer && (
          <>
            <div className="border-t border-dashed border-black my-2" />
            <div className="text-center mt-2">{company.receipt_footer}</div>
          </>
        )}

        <div className="text-center mt-3 text-[10px]">Powered by TrendLink ERP</div>
      </div>
    </div>
  )
}