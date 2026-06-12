import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { messages as seed } from '../mock/data'
import TopBar from '../components/TopBar'

// Сообщения (личный блок → Сообщения): внутренние сообщения / новости.
export default function MessagesScreen() {
  const navigate = useNavigate()
  const [msgs, setMsgs] = useState(seed.map((m) => ({ ...m })))
  const [openId, setOpenId] = useState<number | null>(seed[0]?.id ?? null)
  const open = msgs.find((m) => m.id === openId) ?? null

  const select = (id: number) => {
    setOpenId(id)
    setMsgs((ms) => ms.map((m) => (m.id === id ? { ...m, unread: false } : m)))
  }

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title={`Сообщения${msgs.some((m) => m.unread) ? ` · непрочитанных: ${msgs.filter((m) => m.unread).length}` : ''}`} />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 bg-black/30 overflow-auto">
          {msgs.map((m) => (
            <button key={m.id} onClick={() => select(m.id)}
              className={`w-full text-left px-4 py-3 border-b border-white/10 ${openId === m.id ? 'bg-pos-blue' : 'hover:bg-white/5'}`}>
              <div className="flex items-center gap-2">
                {m.unread && <span className="w-2 h-2 rounded-full bg-pos-accent" />}
                <span className={m.unread ? 'font-semibold' : ''}>{m.title}</span>
              </div>
              <div className="text-xs text-white/50">{m.from} · {m.date}</div>
            </button>
          ))}
        </div>
        <div className="flex-1 p-6">
          {open ? (
            <div className="max-w-2xl">
              <div className="text-lg font-semibold">{open.title}</div>
              <div className="text-sm text-white/50 mb-4">{open.from} · {open.date}</div>
              <div className="text-white/80 leading-relaxed">{open.body}</div>
            </div>
          ) : <div className="text-white/40">Нет сообщений</div>}
        </div>
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>
    </div>
  )
}
