import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Paperclip, CheckCheck, Reply, Send } from 'lucide-react'
import { usePos } from '../store/pos'
import { printToast, toast } from '../lib/print'
import TopBar from '../components/TopBar'

// Сообщения (личный блок → Сообщения): внутренние сообщения / новости (из офиса).
// Важные — красным; непрочитанные — жирным; вложения — скрепка; ответ → исходящее «Re:».
export default function MessagesScreen() {
  const navigate = useNavigate()
  const { messages: msgs, markMessageRead, markAllMessagesRead, replyMessage } = usePos()
  const [openId, setOpenId] = useState<number | null>(msgs[0]?.id ?? null)
  const [replying, setReplying] = useState(false)
  const [draft, setDraft] = useState('')
  const open = msgs.find((m) => m.id === openId) ?? null

  const select = (id: number) => { setOpenId(id); setReplying(false); setDraft(''); markMessageRead(id) }
  const unread = msgs.filter((m) => m.unread).length

  const sendReply = () => {
    if (!open || !draft.trim()) return
    replyMessage(open.title, draft.trim())
    toast('Ответ отправлен в офис')
    setDraft(''); setReplying(false)
  }

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title={`Сообщения${unread ? ` · непрочитанных: ${unread}` : ''}`} />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 bg-black/30 overflow-auto flex flex-col">
          <button onClick={markAllMessagesRead} disabled={unread === 0}
            className="flex items-center gap-2 px-4 h-10 text-sm border-b border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-30 shrink-0">
            <CheckCheck size={15} />Прочитать всё
          </button>
          {msgs.map((m) => (
            <button key={m.id} onClick={() => select(m.id)}
              className={`w-full text-left px-4 py-3 border-b border-white/10 ${openId === m.id ? 'bg-pos-blue' : 'hover:bg-white/5'}`}>
              <div className="flex items-center gap-2">
                {m.outgoing
                  ? <Reply size={13} className="text-white/40 shrink-0" />
                  : m.important
                    ? <AlertTriangle size={13} className="text-pos-rose shrink-0" />
                    : m.unread && <span className="w-2 h-2 rounded-full bg-pos-accent shrink-0" />}
                <span className={`${m.unread ? 'font-semibold' : ''} ${m.important ? 'text-pos-rose' : ''}`}>{m.title}</span>
                {m.attachments && m.attachments.length > 0 && <Paperclip size={12} className="text-white/40 ml-auto shrink-0" />}
              </div>
              <div className="text-xs text-white/50">{m.from} · {m.date}</div>
            </button>
          ))}
        </div>
        <div className="flex-1 p-6 overflow-auto">
          {open ? (
            <div className="max-w-2xl">
              <div className={`text-lg font-semibold ${open.important ? 'text-pos-rose' : ''}`}>
                {open.important && <AlertTriangle size={18} className="inline mr-2 -mt-1" />}{open.title}
              </div>
              <div className="text-sm text-white/50 mb-4">{open.from} · {open.date}{open.important ? ' · важное' : ''}{open.outgoing ? ' · исходящее' : ''}</div>
              <div className="text-white/80 leading-relaxed whitespace-pre-line">{open.body}</div>

              {open.attachments && open.attachments.length > 0 && (
                <div className="mt-5">
                  <div className="text-white/50 text-sm mb-2">Вложения</div>
                  <div className="flex flex-wrap gap-2">
                    {open.attachments.map((a) => (
                      <button key={a} onClick={() => printToast(`Вложение «${a}» открыто`)}
                        className="flex items-center gap-2 h-9 px-3 rounded-md bg-white/10 hover:bg-white/20 text-sm">
                        <Paperclip size={14} />{a}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!open.outgoing && (
                <div className="mt-6">
                  {!replying ? (
                    <button onClick={() => setReplying(true)} className="flex items-center gap-2 h-11 px-4 rounded-md bg-pos-blue">
                      <Reply size={16} />Ответить
                    </button>
                  ) : (
                    <div className="bg-white/5 rounded-lg p-3 max-w-xl">
                      <div className="text-white/60 text-sm mb-2">Ответ на «{open.title}»</div>
                      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} autoFocus
                        placeholder="Текст ответа в офис…"
                        className="w-full rounded-md p-2 text-gray-800 text-sm outline-none resize-none" />
                      <div className="flex gap-2 mt-2">
                        <button onClick={sendReply} disabled={!draft.trim()}
                          className="flex items-center gap-2 h-10 px-4 rounded-md bg-pos-green text-white disabled:opacity-40">
                          <Send size={15} />Отправить
                        </button>
                        <button onClick={() => { setReplying(false); setDraft('') }} className="h-10 px-4 rounded-md bg-white/10">Отмена</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
