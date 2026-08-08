import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

function Kpi({ label, value, accent }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">{label}</div>
      <div className={`text-2xl font-semibold ${accent || 'text-slate-100'}`}>{value}</div>
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState(null)
  const [lowStock, setLowStock] = useState([])
  const [recentSales, setRecentSales] = useState([])

  useEffect(() => {
    const load = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [{ data: salesToday }, { data: products }, { data: sales }] = await Promise.all([
        supabase.from('sales').select('total').gte('sale_date', today.toISOString()),
        supabase.from('products').select('id,name,quantity,min_stock').order('quantity', { ascending: true }),
        supabase.from('sales').select('id,invoice_no,total,payment_status,sale_date').order('sale_date', { ascending: false }).limit(5)
      ])

      const todayTotal = (salesToday || []).reduce((s, r) => s + Number(r.total || 0), 0)
      const low = (products || []).filter(p => Number(p.quantity) <= Number(p.min_stock))
      const unpaidCount = (sales || []).filter(s => s.payment_status !== 'paid').length

      setStats({
        todayTotal,
        productCount: (products || []).length,
        lowStockCount: low.length,
        unpaidCount
      })
      setLowStock(low.slice(0, 5))
      setRecentSales(sales || [])
    }
    load()
  }, [])

  return (
    <div>
      <div className="mb-6">
        <div className="text-slate-400 text-sm">Welcome back,</div>
        <h1 className="text-2xl font-semibold text-slate-100">{profile?.full_name || '—'}</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi label="Sales today" value={stats ? `MWK ${stats.todayTotal.toLocaleString()}` : '…'} accent="text-surge" />
        <Kpi label="Active products" value={stats ? stats.productCount : '…'} />
        <Kpi label="Low stock items" value={stats ? stats.lowStockCount : '…'} accent={stats?.lowStockCount ? 'text-volt' : ''} />
        <Kpi label="Unpaid invoices (recent)" value={stats ? stats.unpaidCount : '…'} accent={stats?.unpaidCount ? 'text-bad' : ''} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="font-medium text-slate-100 mb-3">Low stock alerts</div>
          {lowStock.length === 0 ? (
            <div className="text-sm text-slate-500">Nothing below reorder level. Good shape.</div>
          ) : (
            <ul className="space-y-2">
              {lowStock.map(p => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span className="text-slate-200">{p.name}</span>
                  <span className="text-volt font-mono">{p.quantity} left</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="font-medium text-slate-100 mb-3">Recent sales</div>
          {recentSales.length === 0 ? (
            <div className="text-sm text-slate-500">No sales recorded yet.</div>
          ) : (
            <ul className="space-y-2">
              {recentSales.map(s => (
                <li key={s.id} className="flex justify-between text-sm">
                  <span className="text-slate-200 font-mono">{s.invoice_no}</span>
                  <span className={s.payment_status === 'paid' ? 'text-good' : 'text-volt'}>
                    MWK {Number(s.total).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
