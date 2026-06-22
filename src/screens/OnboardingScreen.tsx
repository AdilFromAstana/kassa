import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuth } from '../api/auth'
import { addPoint } from '../api/structure'
import { setActivePoint } from '../api/activePoint'
import { createStaff, seedCatalogTemplate } from '../api/domain'

// Мастер первого запуска (owner нового клиента): первая точка → сотрудник → стартовый каталог.
// Шаги необязательны — можно пропустить и сделать позже в офисе.
export default function OnboardingScreen() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [done, setDone] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  // step 2
  const [pointName, setPointName] = useState('')
  // step 3
  const [staff, setStaff] = useState({ name: '', pin: '' })
  // step 4 handled by button

  if (getAuth()?.kind !== 'office') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 w-96 text-center">
          <div className="text-lg font-semibold mb-2">Нужен вход владельца</div>
          <button onClick={() => navigate('/register')} className="h-10 px-4 rounded bg-emerald-500 text-white">Зарегистрировать сеть</button>
        </div>
      </div>
    )
  }

  const createFirstPoint = async () => {
    if (!pointName.trim()) return
    setBusy(true); const r = await addPoint(pointName.trim(), undefined as unknown as string); setBusy(false)
    if (r) { setActivePoint(r.tradePointId); setDone((d) => ({ ...d, 2: `точка «${pointName}» создана` })); setStep(3) } // дальше staff/каталог идут на новую точку
    else { setDone((d) => ({ ...d, 2: 'ошибка создания' })) }
  }
  const addFirstStaff = async () => {
    if (!staff.name.trim() || !staff.pin.trim()) { setStep(4); return }
    setBusy(true); await createStaff(staff.name.trim(), staff.pin.trim(), ['Официант']); setBusy(false)
    setDone((d) => ({ ...d, 3: `сотрудник «${staff.name}» (PIN ${staff.pin})` })); setStep(4)
  }
  const seedCatalog = async () => {
    setBusy(true); const r = await seedCatalogTemplate(); setBusy(false)
    setDone((d) => ({ ...d, 4: r?.seeded ? `каталог засеян (${r.dishes} блюд)` : 'каталог уже был' })); setStep(5)
  }

  const Step = ({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) => (
    <div className={`rounded-lg border p-4 mb-3 ${step === n ? 'border-emerald-400 bg-white' : 'border-gray-200 bg-white/60'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${done[n] ? 'bg-emerald-500' : step === n ? 'bg-indigo-600' : 'bg-gray-300'}`}>{done[n] ? '✓' : n}</span>
        <span className="font-medium">{title}</span>
        {done[n] && <span className="text-emerald-600 text-xs ml-auto">{done[n]}</span>}
      </div>
      {step === n && <div className="ml-8">{children}</div>}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-2xl font-semibold mb-1">Настройка сети</div>
        <div className="text-gray-500 text-sm mb-5">Несколько шагов, чтобы начать работу. Можно пропустить и сделать позже в офисе.</div>

        <Step n={1} title="Сеть создана">
          <div className="text-sm text-gray-600 mb-3">Владелец вошёл. Дальше — первая точка.</div>
          <button onClick={() => { setDone((d) => ({ ...d, 1: 'готово' })); setStep(2) }} className="h-9 px-4 rounded bg-indigo-600 text-white text-sm">Начать →</button>
        </Step>

        <Step n={2} title="Первая точка (ТП)">
          <input value={pointName} onChange={(e) => setPointName(e.target.value)} placeholder="Напр. «Кафе на Абая»" className="h-9 w-full rounded border border-gray-300 px-3 mb-2" />
          <div className="flex gap-2">
            <button disabled={busy} onClick={createFirstPoint} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm disabled:opacity-50">Создать точку</button>
            <button onClick={() => setStep(3)} className="h-9 px-4 rounded text-gray-500 text-sm">Пропустить</button>
          </div>
        </Step>

        <Step n={3} title="Первый сотрудник">
          <div className="flex gap-2 mb-2">
            <input value={staff.name} onChange={(e) => setStaff({ ...staff, name: e.target.value })} placeholder="ФИО" className="h-9 rounded border border-gray-300 px-3 flex-1" />
            <input value={staff.pin} onChange={(e) => setStaff({ ...staff, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="PIN" className="h-9 w-24 rounded border border-gray-300 px-3" />
          </div>
          <div className="flex gap-2">
            <button disabled={busy} onClick={addFirstStaff} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm disabled:opacity-50">Добавить</button>
            <button onClick={() => setStep(4)} className="h-9 px-4 rounded text-gray-500 text-sm">Пропустить</button>
          </div>
        </Step>

        <Step n={4} title="Стартовый каталог">
          <div className="text-sm text-gray-600 mb-3">Засеять готовое меню (группы, блюда, модификаторы) — потом отредактируете.</div>
          <div className="flex gap-2">
            <button disabled={busy} onClick={seedCatalog} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm disabled:opacity-50">Засеять каталог</button>
            <button onClick={() => setStep(5)} className="h-9 px-4 rounded text-gray-500 text-sm">Пропустить</button>
          </div>
        </Step>

        {step >= 5 && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-center">
            <div className="font-semibold text-emerald-800 mb-2">Готово! Сеть настроена.</div>
            <button onClick={() => navigate('/office')} className="h-10 px-6 rounded bg-indigo-600 text-white">Перейти в офис →</button>
          </div>
        )}
      </div>
    </div>
  )
}
