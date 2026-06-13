import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { usePos } from '../store/pos'
import NumPad from '../components/NumPad'
import type { Staff } from '../types'

// Стартовый экран: вход по 4-значному PIN → открытие личной смены (выбор должности).
export default function LoginScreen() {
  const navigate = useNavigate()
  const { login, openPersonalShift } = usePos()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [authed, setAuthed] = useState<Staff | null>(null)

  const submit = (value: string) => {
    const s = login(value)
    if (s) { setAuthed(s); setError('') }
    else { setError('Неверный PIN'); setPin('') }
  }

  const onKey = (d: string) => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) setTimeout(() => submit(next), 150)
  }

  const choosePosition = (position: string) => {
    openPersonalShift(position)
    navigate('/menu')
  }

  return (
    <div className="h-full bg-pos-bg text-white flex items-center justify-center"
         style={{ backgroundImage: 'linear-gradient(135deg,#3a3a3a,#1f1f1f)' }}>
      {!authed ? (
        <div className="flex flex-col items-center gap-6">
          <div className="text-2xl font-light tracking-wide">iiko POS — вход</div>
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`w-5 h-5 rounded-full border-2 ${i < pin.length ? 'bg-pos-accent border-pos-accent' : 'border-gray-400'}`} />
            ))}
          </div>
          <div className="h-5 text-pos-rose text-sm">{error}</div>
          <NumPad onKey={onKey} onBackspace={() => setPin(pin.slice(0, -1))} onClear={() => setPin('')} />
          <div className="text-xs text-gray-400 text-center max-w-xs">
            PIN-коды (мок): Петров <b>1111</b>, Иванова <b>2222</b>, Легасов <b>3333</b>, Админ <b>0000</b>
          </div>
          <button onClick={() => navigate('/office')} className="text-xs text-gray-500 hover:text-pos-accent underline underline-offset-2">
            Бэк-офис (iikoOffice, мок) →
          </button>
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
          <button onClick={() => { setAuthed(null); setPin('') }} className="text-sm text-gray-400 mt-2 inline-flex items-center gap-1"><ChevronLeft size={14} /> назад ко входу</button>
        </div>
      )}
    </div>
  )
}
