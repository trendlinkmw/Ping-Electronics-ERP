import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'
import { supabase } from '../supabaseClient'

const RANGE_OPTIONS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
]

const PIE_COLORS = ['#22D3EE', '#F5A524', '#34D399', '#F87171', '#818CF8', '#F472B6', '#A3E635', '#FB923C', '#38BDF8']
const MOVING_AVG_WINDOW = 7

function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? null : 0 // null = "new" (no baseline to compare to)
  return ((current - previous) / previous) * 100
}

function ChangeBadge({ value }) {
  if (value === null) return <span className="text-xs text-slate-500 ml-2">new</span>
  const up = value >= 0
  return (
    <span className={`text-xs ml-2 ${up ? 'text-good' : 'text-bad'}`}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}% vs prior period
    </span>
  )
}

function Kpi({ label, value, accent, change }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">{label}</div>
      <div className={`text-2xl font-semibold ${accent || 'text-slate-100'}`}>{value}</div>
      {change !== undefined && <ChangeBadge value={change} />}
    </div>
  )
}

// Fetch revenue, cost and expense totals for an arbitrary [since, until) window.
async function fetchWindowTotals(since, until) {
  const [{ data: sales }, { data: items }, { data: expenses }] = await Promise.all([
    supabase.from('sales').select('total, sale_date').gte('sale_date', since.toISOString()).lt('sale_date', until.toISOString()),
    supabase.from('sale_items')
      .select('quantity, subtotal, product:products(buying_price), sales!inner(sale_date)')
      .gte('sales.sale_date', since.toISOString()).lt('sales.sale_date', until.toISOString()),
    supabase.from('expenses').select('amount, expense_date')
      .gte('expense_date', since.toISOString().slice(0, 10)).lt('expense_date', until.toISOString().slice(0, 10)),
  ])
  const revenue = (sales || []).reduce((s, r) => s + Number(r.total), 0)
  const cost = (items || []).reduce((s, it) => s + Number(it.product?.buying_price || 0) * Number(it.quantity), 0)
  const expensesTotal = (expenses || []).reduce((s, r) => s + Number(r.amount), 0)
  return { revenue, cost, profit: revenue - cost, expenses: expensesTotal, sales: sales || [], items: items || [], rawExpenses: expenses || [] }
}

export default function Reports() {
  const [rangeDays, setRangeDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [chartData, setChartData] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [expenseSlices, setExpenseSlices] = useState([])
  const [totals, setTotals] = useState({ revenue: 0, cost: 0, profit: 0, expenses: 0 })
  const [changes, setChanges] = useState({ revenue: null, profit: null, expenses: null })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const since = new Date()
        since.setDate(since.getDate() - rangeDays)
        since.setHours(0, 0, 0, 0)
        const until = new Date() // now

        const prevSince = new Date(since)
        prevSince.setDate(prevSince.getDate() - rangeDays)
        const prevUntil = new Date(since)

        const [current, previous] = await Promise.all([
          fetchWindowTotals(since, until),
          fetchWindowTotals(prevSince, prevUntil),
        ])

        // --- Build the day-by-day series: revenue, profit, and a trailing moving average ---
        // Loop runs through rangeDays+1 buckets so "today" (i === rangeDays) is included —
        // since `until` is right now, excluding today would silently drop today's sales from the chart.
        const dayMap = {}
        for (let i = 0; i <= rangeDays; i++) {
          const d = new Date(since)
          d.setDate(d.getDate() + i)
          dayMap[d.toISOString().slice(0, 10)] = { revenue: 0, cost: 0 }
        }
        current.sales.forEach(s => {
          const key = s.sale_date.slice(0, 10)
          if (key in dayMap) dayMap[key].revenue += Number(s.total)
        })
        current.items.forEach(it => {
          const key = it.sales?.sale_date?.slice(0, 10)
          if (key && key in dayMap) dayMap[key].cost += Number(it.product?.buying_price || 0) * Number(it.quantity)
        })

        const ordered = Object.entries(dayMap).map(([date, v]) => ({
          date: date.slice(5),
          revenue: v.revenue,
          profit: v.revenue - v.cost,
        }))

        // 7-day trailing moving average of revenue, smooths day-to-day noise
        const series = ordered.map((row, i) => {
          const windowSlice = ordered.slice(Math.max(0, i - MOVING_AVG_WINDOW + 1), i + 1)
          const avg = windowSlice.reduce((s, r) => s + r.revenue, 0) / windowSlice.length
          return { ...row, avg: Math.round(avg) }
        })

        // --- Top products ---
        const { data: itemsForTop } = await supabase
          .from('sale_items')
          .select('quantity, subtotal, product:products(name), sales!inner(sale_date)')
          .gte('sales.sale_date', since.toISOString())
        const topMap = {}
        ;(itemsForTop || []).forEach(it => {
          const name = it.product?.name || 'Unknown product'
          if (!topMap[name]) topMap[name] = { name, revenue: 0 }
          topMap[name].revenue += Number(it.subtotal)
        })
        const topProductsList = Object.values(topMap).sort((a, b) => b.revenue - a.revenue).slice(0, 6)

        // --- Expenses by category ---
        const { data: expensesWithCategory } = await supabase
          .from('expenses').select('amount, category').gte('expense_date', since.toISOString().slice(0, 10))
        const expMap = {}
        ;(expensesWithCategory || []).forEach(e => {
          expMap[e.category] = (expMap[e.category] || 0) + Number(e.amount)
        })
        const expenseList = Object.entries(expMap).map(([name, value]) => ({ name, value }))

        setChartData(series)
        setTopProducts(topProductsList)
        setExpenseSlices(expenseList)
        setTotals({ revenue: current.revenue, cost: current.cost, profit: current.profit, expenses: current.expenses })
        setChanges({
          revenue: pctChange(current.revenue, previous.revenue),
          profit: pctChange(current.profit, previous.profit),
          expenses: pctChange(current.expenses, previous.expenses),
        })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [rangeDays])

  const netAfterExpenses = totals.profit - totals.expenses

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-slate-100">Reports</h1>
        <select className="input max-w-[160px]" value={rangeDays} onChange={e => setRangeDays(Number(e.target.value))}>
          {RANGE_OPTIONS.map(o => <option key={o.days} value={o.days}>{o.label}</option>)}
        </select>
      </div>

      {error && <div className="text-bad text-sm mb-4">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi label="Revenue" value={`MWK ${totals.revenue.toLocaleString()}`} accent="text-surge" change={changes.revenue} />
        <Kpi label="Cost of goods sold" value={`MWK ${totals.cost.toLocaleString()}`} />
        <Kpi label="Gross profit" value={`MWK ${totals.profit.toLocaleString()}`} accent="text-good" change={changes.profit} />
        <Kpi
          label="Net after expenses"
          value={`MWK ${netAfterExpenses.toLocaleString()}`}
          accent={netAfterExpenses >= 0 ? 'text-good' : 'text-bad'}
        />
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="font-medium text-slate-100">Sales trend</div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-surge/60 inline-block" /> Revenue</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 rounded-sm bg-good inline-block" /> Profit</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 rounded-sm bg-volt inline-block" style={{ borderTop: '1px dashed' }} /> 7-day avg</span>
          </div>
        </div>
        {loading ? (
          <div className="text-sm text-slate-500 h-72 flex items-center justify-center">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="date" stroke="#64748B" fontSize={12} />
              <YAxis stroke="#64748B" fontSize={12} />
              <Tooltip
                contentStyle={{ background: '#111A2B', border: '1px solid #1E293B', borderRadius: 8, fontSize: 12 }}
                formatter={(v, name) => [`MWK ${Number(v).toLocaleString()}`, name]}
              />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#22D3EE" strokeWidth={2} fill="url(#revenueFill)" />
              <Line type="monotone" dataKey="profit" name="Profit" stroke="#34D399" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="avg" name="7-day avg" stroke="#F5A524" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="font-medium text-slate-100 mb-4">Top products by revenue</div>
          {loading ? (
            <div className="text-sm text-slate-500 h-64 flex items-center justify-center">Loading…</div>
          ) : topProducts.length === 0 ? (
            <div className="text-sm text-slate-500">No sales in this period yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
                <XAxis type="number" stroke="#64748B" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#64748B" fontSize={11} width={110} />
                <Tooltip
                  contentStyle={{ background: '#111A2B', border: '1px solid #1E293B', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`MWK ${Number(v).toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#F5A524" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <div className="font-medium text-slate-100 mb-4">Expenses by category</div>
          {loading ? (
            <div className="text-sm text-slate-500 h-64 flex items-center justify-center">Loading…</div>
          ) : expenseSlices.length === 0 ? (
            <div className="text-sm text-slate-500">No expenses recorded in this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={expenseSlices} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {expenseSlices.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#111A2B', border: '1px solid #1E293B', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`MWK ${Number(v).toLocaleString()}`, '']}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}