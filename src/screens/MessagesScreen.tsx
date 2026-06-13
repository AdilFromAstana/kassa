import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { usePos } from '../store/pos'
import TopBar from '../components/TopBar'

// Сообщения (личный блок → Сообщения): внутренние сообщения / новости (из офиса).
// Важные выделяются красным; непрочитанные — жирным. Сообщения в общем сторе (конверт в TopBar).
export default function MessagesScreen() {
  const navigate = useNavigate()
  const { messages: msgs, markMessageRead } = usePos()
  const [openId, setOpenId] = useState<number | null>(msgs[0]?.id ?? null)
  const open = msgs.find((m) => m.id === openId) ?? null

  const select = (id: number) => { setOpenId(id); markMessageRead(id) }
  const unread = msgs.filter((m) => m.unread).length

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title={`Сообщения${unread ? ` · непрочитанных: ${unread}` : ''}`} />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 bg-black/30 overflow-auto">
          {msgs.map((m) => (
            <button key={m.id} onClick={() => select(m.id)}
              className={`w-full text-left px-4 py-3 border-b border-white/10 ${openId === m.id ? 'bg-pos-blue' : 'hover:bg-white/5'}`}>
              <div className="flex items-center gap-2">
                {m.important
                  ? <AlertTriangle size={13} className="text-pos-rose shrink-0" />
                  : m.unread && <span className="w-2 h-2 rounded-full bg-pos-accent shrink-0" />}
                <span className={`${m.unread ? 'font-semibold' : ''} ${m.important ? 'text-pos-rose' : ''}`}>{m.title}</span>
              </div>
              <div className="text-xs text-white/50">{m.from} · {m.date}</div>
            </button>
          ))}
        </div>
        <div className="flex-1 p-6">
          {open ? (
            <div className="max-w-2xl">
              <div className={`text-lg font-semibold ${open.important ? 'text-pos-rose' : ''}`}>
                {open.important && <AlertTriangle size={18} className="inline mr-2 -mt-1" />}{open.title}
              </div>
              <div className="text-sm text-white/50 mb-4">{open.from} · {open.date}{open.important ? ' · важное' : ''}</div>
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
