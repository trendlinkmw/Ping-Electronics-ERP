import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Sales from './pages/Sales'
import Customers from './pages/Customers'
import Suppliers from './pages/Suppliers'
import Purchases from './pages/Purchases'
import Expenses from './pages/Expenses'
import Payments from './pages/Payments'
import UserManagement from './pages/UserManagement'
import Reports from './pages/Reports'
import StockAdjustment from './pages/StockAdjustment'
import Settings from './pages/Settings'
import Receipt from './pages/Receipt'
import SalesHistory from './pages/SalesHistory'
import CustomerDetail from './pages/CustomerDetail'
import SupplierDetail from './pages/SupplierDetail'

const DASHBOARD_ROLES = ['manager', 'accountant', 'ceo', 'administrator']

// Landing page after login — sends each role to the screen that matters to them,
// instead of everyone hitting the business-overview Dashboard by default.
function Home() {
  const { hasRole } = useAuth()

  if (hasRole(...DASHBOARD_ROLES)) return <Layout><Dashboard /></Layout>
  if (hasRole('salesperson', 'cashier')) return <Navigate to="/sales" replace />
  if (hasRole('storekeeper')) return <Navigate to="/products" replace />

  return (
    <Layout>
      <div className="text-sm text-slate-500">
        Your account doesn't have a role assigned yet. Ask an administrator to grant you access in User Management.
      </div>
    </Layout>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={
        <ProtectedRoute><Home /></ProtectedRoute>
      } />
      <Route path="/products" element={
        <ProtectedRoute allow={['manager', 'storekeeper']}><Layout><Products /></Layout></ProtectedRoute>
      } />
      <Route path="/sales" element={
        <ProtectedRoute allow={['salesperson', 'cashier', 'manager']}><Layout><Sales /></Layout></ProtectedRoute>
      } />
      <Route path="/customers" element={
        <ProtectedRoute allow={['manager', 'salesperson']}><Layout><Customers /></Layout></ProtectedRoute>
      } />
      <Route path="/customers/:id" element={
        <ProtectedRoute allow={['manager', 'salesperson']}><Layout><CustomerDetail /></Layout></ProtectedRoute>
      } />
      <Route path="/suppliers" element={
        <ProtectedRoute allow={['manager', 'storekeeper']}><Layout><Suppliers /></Layout></ProtectedRoute>
      } />
      <Route path="/suppliers/:id" element={
        <ProtectedRoute allow={['manager', 'storekeeper']}><Layout><SupplierDetail /></Layout></ProtectedRoute>
      } />
      <Route path="/purchases" element={
        <ProtectedRoute allow={['manager', 'storekeeper']}><Layout><Purchases /></Layout></ProtectedRoute>
      } />
      <Route path="/expenses" element={
        <ProtectedRoute allow={['accountant']}><Layout><Expenses /></Layout></ProtectedRoute>
      } />
      <Route path="/payments" element={
        <ProtectedRoute allow={['cashier', 'accountant', 'salesperson', 'manager']}><Layout><Payments /></Layout></ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute allow={[]}><Layout><UserManagement /></Layout></ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute allow={['manager', 'accountant', 'ceo']}><Layout><Reports /></Layout></ProtectedRoute>
      } />
      <Route path="/stock-adjustment" element={
        <ProtectedRoute allow={['manager', 'storekeeper']}><Layout><StockAdjustment /></Layout></ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute allow={[]}><Layout><Settings /></Layout></ProtectedRoute>
      } />
      <Route path="/receipt/:saleId" element={
        <ProtectedRoute allow={['salesperson', 'cashier', 'manager', 'accountant']}><Receipt /></ProtectedRoute>
      } />
      <Route path="/history" element={
        <ProtectedRoute allow={['salesperson', 'cashier', 'manager', 'accountant']}><Layout><SalesHistory /></Layout></ProtectedRoute>
      } />
    </Routes>
  )
}