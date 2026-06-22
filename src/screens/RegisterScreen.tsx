import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerNetwork } from '../api/auth'

// Self-serve регистрация новой сети (публичная): название + БИН + email/пароль владельца → office-токен → /office.
export default function RegisterScreen() {
  const navigate = useNavigate()
  const [f, setF] = useState({ networkName: '', bin: '', email: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setErr('')
    if (!f.networkName.trim() || !f.email.trim() || !f.password) { setErr('Заполните название сети, email и пароль'); return }
    setBusy(true)
    const a = await registerNetwork(f.networkName.trim(), f.email.trim(), f.password, f.bin.trim())
    setBusy(false)
    if (!a) { setErr('Не удалось зарегистрировать (email уже занят?)'); return }
    navigate('/onboarding') // владелец вошёл → мастер первого запуска
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow p-8 w-[26rem]">
        <div className="text-xl font-semibold mb-1">Регистрация сети</div>
        <div className="text-gray-500 text-sm mb-5">Создайте свою сеть ресторанов в iiko-POS</div>
        <label className="block text-xs text-gray-500 mb-1">Название сети</label>
        <input value={f.networkName} onChange={(e) => setF({ ...f, networkName: e.target.value })} placeholder="Напр. Сеть «Достар»" className="h-10 w-full rounded border border-gray-300 px-3 mb-3" />
        <label className="block text-xs text-gray-500 mb-1">БИН (необязательно)</label>
        <input value={f.bin} onChange={(e) => setF({ ...f, bin: e.target.value.replace(/\D/g, '') })} placeholder="123456789012" className="h-10 w-full rounded border border-gray-300 px-3 mb-3" />
        <label className="block text-xs text-gray-500 mb-1">Email владельца</label>
        <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="owner@network.kz" className="h-10 w-full rounded border border-gray-300 px-3 mb-3" />
        <label className="block text-xs text-gray-500 mb-1">Пароль</label>
        <input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} type="password" placeholder="пароль" className="h-10 w-full rounded border border-gray-300 px-3 mb-4" onKeyDown={(e) => e.key === 'Enter' && submit()} />
        {err && <div className="text-red-500 text-sm mb-2">{err}</div>}
        <button disabled={busy} onClick={submit} className="h-10 w-full rounded bg-emerald-500 text-white disabled:opacity-50">Создать сеть</button>
        <button onClick={() => navigate('/platform')} className="h-10 w-full rounded mt-2 text-gray-500 text-sm">← Назад к платформе</button>
      </div>
    </div>
  )
}
