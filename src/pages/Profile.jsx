import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const [form, setForm] = useState({ full_name: '', phone: '', position: '' })
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwNotice, setPwNotice] = useState('')

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        position: profile.position || '',
      })
      setAvatarUrl(profile.avatar_url || '')
    }
  }, [profile])

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: profErr } = await supabase.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', user.id)
      if (profErr) throw profErr

      setAvatarUrl(pub.publicUrl)
      refreshProfile()
      setNotice('Profile picture updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const submitDetails = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setSaving(true)
    try {
      const { error: err } = await supabase.from('profiles').update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        position: form.position.trim() || null,
      }).eq('id', user.id)
      if (err) throw err
      refreshProfile()
      setNotice('Details saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const submitPassword = async (e) => {
    e.preventDefault()
    setPwError('')
    setPwNotice('')
    if (newPassword.length < 6) {
      setPwError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords don\'t match.')
      return
    }
    setPwSaving(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword })
      if (err) throw err
      setPwNotice('Password updated.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPwError(err.message)
    } finally {
      setPwSaving(false)
    }
  }

  if (!profile) return <div className="text-sm text-slate-500">Loading…</div>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100 mb-6">My Profile</h1>

      <div className="space-y-6 max-w-2xl">
        <div className="card p-5">
          <div className="font-medium text-slate-100 mb-4">Profile picture</div>
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border border-line" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-ink border border-line flex items-center justify-center text-slate-500 text-2xl">
                {form.full_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <label className="btn-ghost text-sm cursor-pointer">
              {uploading ? 'Uploading…' : 'Change photo'}
              <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} disabled={uploading} />
            </label>
          </div>
        </div>

        <form onSubmit={submitDetails} className="card p-5 space-y-4">
          <div className="font-medium text-slate-100">Personal details</div>

          <div>
            <label className="label">Full name</label>
            <input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Position</label>
              <input className="input" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="e.g. Store Manager" />
            </div>
          </div>

          <div>
            <label className="label">Email</label>
            <input className="input opacity-60" value={user.email} disabled />
            <p className="text-xs text-slate-500 mt-1">Contact an administrator to change your email address.</p>
          </div>

          <div>
            <label className="label">Roles</label>
            <div className="text-sm text-slate-300 capitalize">
              {profile.employment_status === 'inactive' ? 'Account deactivated' : 'Active account'}
            </div>
          </div>

          {error && <div className="text-bad text-sm">{error}</div>}
          {notice && <div className="text-good text-sm">{notice}</div>}

          <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save details'}</button>
        </form>

        <form onSubmit={submitPassword} className="card p-5 space-y-4">
          <div className="font-medium text-slate-100">Change password</div>
          <p className="text-xs text-slate-500">Already signed in — this changes your password immediately, no email needed.</p>

          <div>
            <label className="label">New password</label>
            <input type="password" className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} required />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type="password" className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={6} required />
          </div>

          {pwError && <div className="text-bad text-sm">{pwError}</div>}
          {pwNotice && <div className="text-good text-sm">{pwNotice}</div>}

          <button className="btn-primary" disabled={pwSaving}>{pwSaving ? 'Updating…' : 'Update password'}</button>
        </form>
      </div>
    </div>
  )
}