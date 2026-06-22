import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginPlatform, setAuth, getAuth, logout } from '../api/auth'
import { listTenants, createTenant, loginAsClient, setTenantStatus, type TenantRow } from '../api/platform'

// Платформенная админка (PlatformAdmin): реестр клиентов-сетей, создание, «войти как клиент», блокировка.
// Демо-вход: admin@platform / admin123.
export default function PlatformScreen() {
  const navigate = useNavigate()
  const [authed, setAuthedState] = useState(getAuth()?.kind === 'platform')
  const [email, setEmail] = useState('admin@platform')
  const [password, setPassword] = useState('admin123')
  const [err, setErr] = useState('')
  const [rows, setRows] = useState<TenantRow[]>([])
  const [busy, setBusy] = useState(false)
  // форма создания клиента
  const [nc, setNc] = useState({ networkName: '', bin: '', ownerEmail: '', ownerName: '', ownerPassword: '' })
  const [msg, setMsg] = useState('')

  const refresh = async () => { const list = await listTenants(); if (list) setRows(list) }
  useEffect(() => { if (authed) void refresh() }, [authed])

  const doLogin = async () => {
    setErr('')
    const a = await loginPlatform(email.trim(), password)
    if (!a) { setErr('Неверный логин или пароль платформы'); return }
    setAuthedState(true)
  }

  const doCreate = async () => {
    setMsg('')
    if (!nc.networkName.trim() || !nc.ownerEmail.trim() || !nc.ownerPassword) { setMsg('Заполните сеть, email и пароль владельца'); return }
    setBusy(true)
    const r = await createTenant(nc.networkName.trim(), nc.bin.trim(), nc.ownerEmail.trim(), nc.ownerName.trim(), nc.ownerPassword)
    setBusy(false)
    if (!r) { setMsg('Не удалось создать (email уже занят?)'); return }
    setMsg(`Создан клиент: ${nc.networkName} · владелец ${r.ownerEmail}`)
    setNc({ networkName: '', bin: '', ownerEmail: '', ownerName: '', ownerPassword: '' })
    void refresh()
  }

  const doLoginAs = async (t: TenantRow) => {
    const r = await loginAsClient(t.id)
    if (!r?.token) { setMsg('Не удалось войти как клиент'); return }
    setAuth({ kind: 'office', token: r.token, tenantId: r.tenantId, role: 'owner' })
    navigate('/office')
  }

  const doToggle = async (t: TenantRow) => {
    await setTenantStatus(t.id, t.status === 'blocked' ? 'active' : 'blocked')
    void refresh()
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 w-96">
          <div className="text-xl font-semibold mb-1">Платформа iiko-POS</div>
          <div className="text-gray-500 text-sm mb-5">Вход администратора платформы</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" className="h-10 w-full rounded border border-gray-300 px-3 mb-2" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="пароль" className="h-10 w-full rounded border border-gray-300 px-3 mb-3" onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
          {err && <div className="text-red-500 text-sm mb-2">{err}</div>}
          <button onClick={doLogin} className="h-10 w-full rounded bg-indigo-600 text-white">Войти</button>
          <button onClick={() => navigate('/register')} className="h-10 w-full rounded mt-2 text-indigo-600 text-sm">Я новый клиент — зарегистрировать сеть →</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="flex items-center mb-4">
        <div className="text-xl font-semibold">Клиенты (реестр сетей)</div>
        <button onClick={() => { logout(); setAuthedState(false) }} className="ml-auto h-9 px-3 rounded bg-gray-200 text-sm">Выйти</button>
      </div>

      {/* создание клиента */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-5">
        <div className="text-gray-500 text-xs uppercase mb-2">Создать клиента (сеть + владелец)</div>
        <div className="flex flex-wrap gap-2 items-center">
          <input value={nc.networkName} onChange={(e) => setNc({ ...nc, networkName: e.target.value })} placeholder="Название сети" className="h-9 rounded border border-gray-300 px-2 flex-1 min-w-[160px]" />
          <input value={nc.bin} onChange={(e) => setNc({ ...nc, bin: e.target.value.replace(/\D/g, '') })} placeholder="БИН" className="h-9 rounded border border-gray-300 px-2 w-40" />
          <input value={nc.ownerName} onChange={(e) => setNc({ ...nc, ownerName: e.target.value })} placeholder="Владелец (имя)" className="h-9 rounded border border-gray-300 px-2 w-44" />
          <input value={nc.ownerEmail} onChange={(e) => setNc({ ...nc, ownerEmail: e.target.value })} placeholder="email владельца" className="h-9 rounded border border-gray-300 px-2 w-52" />
          <input value={nc.ownerPassword} onChange={(e) => setNc({ ...nc, ownerPassword: e.target.value })} type="password" placeholder="пароль" className="h-9 rounded border border-gray-300 px-2 w-36" />
          <button disabled={busy} onClick={doCreate} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm disabled:opacity-50">Создать</button>
        </div>
        {msg && <div className="text-sm text-gray-600 mt-2">{msg}</div>}
      </div>

      {/* реестр */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-gray-500 text-left border-b border-gray-200">
            <th className="p-3">Сеть</th><th>БИН</th><th>Владелец</th><th>Тариф</th><th className="text-center">Точек</th><th className="text-center">Статус</th><th>Создан</th><th className="p-3 text-right">Действия</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={8} className="p-4 text-gray-400">Клиентов нет.</td></tr> : rows.map((t) => (
              <tr key={t.id} className="border-b border-gray-100 last:border-0">
                <td className="p-3 font-medium">{t.name}</td>
                <td className="text-gray-600">{t.bin || '—'}</td>
                <td className="text-gray-600">{t.ownerEmail ?? '—'}</td>
                <td className="text-gray-600 uppercase">{t.plan}</td>
                <td className="text-center">{t.points}</td>
                <td className="text-center">
                  <span className={`px-2 py-0.5 rounded text-xs ${t.status === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{t.status === 'blocked' ? 'заблокирован' : 'активен'}</span>
                </td>
                <td className="text-gray-500">{t.createdAt}</td>
                <td className="p-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => doLoginAs(t)} className="h-8 px-3 rounded bg-indigo-600 text-white text-xs">Войти как клиент</button>
                    <button onClick={() => doToggle(t)} className={`h-8 px-3 rounded text-xs ${t.status === 'blocked' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{t.status === 'blocked' ? 'Разблокировать' : 'Заблокировать'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
