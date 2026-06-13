import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, UserRound, Info, CreditCard } from 'lucide-react'
import { usePos } from '../store/pos'
import { fiscalRegistrators } from '../mock/data'
import NumPad from '../components/NumPad'
import type { Staff } from '../types'

// Стартовый экран: вход по 4-значному PIN, из списка сотрудников или по магнитной карте → выбор должности.
type Mode = 'pin' | 'list' | 'card'

export default function LoginScreen() {
  const navigate = useNavigate()
  const { login, loginByCard, openPersonalShift, staffList, establishment } = usePos()
  const [mode, setMode] = useState<Mode>('pin')
  const [card, setCard] = useState('')
  const [cardErr, setCardErr] = useState('')
  const [picked, setPicked] = useState<Staff | null>(null) // выбран из списка → вводит свой PIN
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [authed, setAuthed] = useState<Staff | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  const submit = (value: string) => {
    const s = login(value)
    // в режиме списка PIN должен принадлежать выбранному сотруднику
    if (s && (!picked || s.id === picked.id)) { setAuthed(s); setError('') }
    else { setError(picked ? `Неверный PIN для ${picked.name.split(' ')[0]}` : 'Неверный PIN'); setPin('') }
  }

  const onKey = (d: string) => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) setTimeout(() => submit(next), 150)
  }

  const choosePosition = (position: string) => { openPersonalShift(position); navigate('/menu') }
  const backToStart = () => { setPicked(null); setPin(''); setError(''); setCard(''); setCardErr('') }
  const switchMode = (m: Mode) => { setMode(m); backToStart() }

  // прокатка магнитной карты (мок ридера)
  const swipe = (value: string) => {
    const s = loginByCard(value)
    if (s) { setAuthed(s); setCardErr('') }
    else { setCardErr('Карта не распознана'); setCard('') }
  }

  return (
    <div className="h-full bg-pos-bg text-white flex items-center justify-center"
         style={{ backgroundImage: 'linear-gradient(135deg,#3a3a3a,#1f1f1f)' }}>
      {!authed ? (
        <div className="flex flex-col items-center gap-5">
          <div className="text-2xl font-light tracking-wide">iiko POS — вход</div>

          {/* переключатель способа входа */}
          <div className="flex gap-1 bg-black/30 rounded-lg p-1">
            {([['pin', 'По PIN'], ['list', 'Список'], ['card', 'Карта']] as const).map(([m, label]) => (
              <button key={m} onClick={() => switchMode(m)}
                className={`h-9 px-4 rounded-md text-sm ${mode === m ? 'bg-pos-blue text-white' : 'text-white/60 hover:text-white'}`}>{label}</button>
            ))}
          </div>

          {mode === 'card' ? (
            <div className="flex flex-col items-center gap-4 w-[420px]">
              <div className="text-white/60 text-sm flex items-center gap-2"><CreditCard size={18} /> Проведите магнитную карту через считыватель</div>
              <form onSubmit={(e) => { e.preventDefault(); if (card.trim()) swipe(card.trim()) }} className="w-full flex gap-2">
                <input value={card} onChange={(e) => { setCard(e.target.value.replace(/\D/g, '')); setCardErr('') }} autoFocus
                  inputMode="numeric" placeholder="номер карты"
                  className="flex-1 h-11 rounded-md px-3 text-gray-800 outline-none" />
                <button type="submit" disabled={!card.trim()} className="h-11 px-5 rounded-md bg-pos-blue text-white disabled:opacity-40">Войти</button>
              </form>
              <div className="h-5 text-pos-rose text-sm">{cardErr}</div>
              <div className="text-xs text-white/40 self-start">Симуляция считывателя (мок) — нажмите карту:</div>
              <div className="grid grid-cols-2 gap-2 w-full">
                {staffList.filter((s) => s.card).map((s) => (
                  <button key={s.id} onClick={() => swipe(s.card!)}
                    className="h-14 rounded-md bg-white/10 hover:bg-white/20 px-3 flex items-center gap-3 text-left">
                    <CreditCard size={18} className="text-white/50 shrink-0" />
                    <span><span className="block">{s.name}</span><span className="text-xs text-white/40">карта •••{s.card!.slice(-4)}</span></span>
                  </button>
                ))}
              </div>
            </div>
          ) : mode === 'list' && !picked ? (
            <div className="grid grid-cols-2 gap-2 w-[420px]">
              {staffList.map((s) => (
                <button key={s.id} onClick={() => { setPicked(s); setPin(''); setError('') }}
                  className="h-16 rounded-md bg-white/10 hover:bg-white/20 px-3 flex items-center gap-3 text-left">
                  <UserRound size={20} className="text-white/50 shrink-0" />
                  <span><span className="block">{s.name}</span><span className="text-xs text-white/50">{s.positions.join(', ')}</span></span>
                </button>
              ))}
            </div>
          ) : (
            <>
              {picked && <div className="text-white/70">PIN для <b>{picked.name}</b></div>}
              <div className="flex gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`w-5 h-5 rounded-full border-2 ${i < pin.length ? 'bg-pos-accent border-pos-accent' : 'border-gray-400'}`} />
                ))}
              </div>
              <div className="h-5 text-pos-rose text-sm">{error}</div>
              <NumPad onKey={onKey} onBackspace={() => setPin(pin.slice(0, -1))} onClear={() => setPin('')} />
              {mode === 'pin' && (
                <div className="text-xs text-gray-400 text-center max-w-xs">
                  PIN-коды (мок): {staffList.map((s, i) => (
                    <span key={s.id}>{i > 0 ? ', ' : ''}{s.name.split(' ')[0]} <b>{s.pin}</b></span>
                  ))}
                </div>
              )}
              {picked && <button onClick={backToStart} className="text-sm text-gray-400 inline-flex items-center gap-1"><ChevronLeft size={14} /> к списку</button>}
            </>
          )}

          <div className="flex items-center gap-4 mt-1">
            <button onClick={() => setShowInfo(true)} className="text-xs text-gray-400 hover:text-pos-accent inline-flex items-center gap-1"><Info size={13} />О терминале</button>
            <button onClick={() => navigate('/office')} className="text-xs text-gray-500 hover:text-pos-accent underline underline-offset-2">
              Бэк-офис (iikoOffice, мок) →
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white text-gray-800 rounded-lg p-8 w-[420px] flex flex-col gap-4">
          <div className="text-lg">Здравствуйте, <b>{authed.name}</b></div>
          <div className="text-sm text-gray-500">Откройте личную смену — выберите должность:</div>
          <div className="flex flex-col gap-2">
            {authed.positions.map((p) => (
              <button key={p} onClick={() => choosePosition(p)}
                      className="h-14 rounded-md bg-pos-blue hover:bg-pos-blueDark text-white text-lg">
                {p}
              </button>
            ))}
          </div>
          <button onClick={() => { setAuthed(null); backToStart() }} className="text-sm text-gray-400 mt-2 inline-flex items-center gap-1"><ChevronLeft size={14} /> назад ко входу</button>
        </div>
      )}

      {showInfo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowInfo(false)}>
          <div className="bg-white text-gray-800 rounded-lg w-[360px] p-5 text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-base mb-3">О терминале</div>
            <InfoRow k="Терминал" v="№998" />
            <InfoRow k="Заведение" v={establishment.name} />
            <InfoRow k="Режим" v={establishment.mode === 'restaurant' ? 'Ресторан' : 'Фастфуд'} />
            <InfoRow k="Версия iikoFront" v="9.x (мок)" />
            <InfoRow k="Налог" v="ҚҚС 16% · Webkassa (ОФД РК)" />
            <div className="border-t my-2" />
            <div className="text-gray-500 mb-1">Фискальные регистраторы:</div>
            {fiscalRegistrators.map((f) => (
              <div key={f.id} className="flex justify-between"><span>{f.name}</span><span className="text-gray-500">ФН {f.fn}</span></div>
            ))}
            <button onClick={() => setShowInfo(false)} className="w-full h-10 mt-4 rounded-md bg-pos-blue text-white">Закрыть</button>
          </div>
        </div>
      )}
    </div>
  )
}

const InfoRow = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between py-0.5"><span className="text-gray-500">{k}:</span><span>{v}</span></div>
)
