import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import logo from '../assets/logo.png'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords don\'t match.'); return }

    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => navigate('/'), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center flex flex-col items-center">
          <img src={logo} alt="Ping Electronics" className="w-16 h-16 object-contain mb-3" />
          <div className="text-2xl font-semibold text-slate-100">Set a new password</div>
        </div>

        {done ? (
          <div className="card p-6 text-center">
            <div className="text-good text-sm">Password updated — taking you in…</div>
          </div>
        ) : (
          <form onSubmit={submit} className="card p-6 space-y-4">
            <div>
              <label className="label">New password</label>
              <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input type="password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={6} required />
            </div>
            {error && <div className="text-bad text-sm">{error}</div>}
            <button className="btn-primary w-full" disabled={busy}>{busy ? 'Updating…' : 'Set new password'}</button>
          </form>
        )}
      </div>
    </div>
  )
}