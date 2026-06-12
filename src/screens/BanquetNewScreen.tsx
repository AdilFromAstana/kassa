import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Menu, Lock, ChevronLeft, Keyboard, ClipboardList } from 'lucide-react'
import { usePos } from '../store/pos'
import { halls, tablesByHall } from '../mock/data'
import type { BanquetType } from '../types'
import TimePickerModal from '../components/TimePickerModal'
import PhonePadModal from '../components/PhonePadModal'
import TextInputModal from '../components/TextInputModal'
import TableSelectModal from '../components/TableSelectModal'
import GuestCountModal from '../components/GuestCountModal'

// Карточка создания резерва/банкета (FRONT_03 §4.4) — 1:1 с iikoFront: колонки КЛИЕНТ / РЕЗЕРВ.
export default function BanquetNewScreen() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const { addBanquet, banquets, logout } = usePos()
  const type: BanquetType = (sp.get('type') as BanquetType) || 'Резерв'

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('+7 ')
  const [card, setCard] = useState('')
  const [other, setOther] = useState('')
  const [extra, setExtra] = useState('')
  const [hallId, setHallId] = useState('')
  const [tableId, setTableId] = useState('')
  const [tableOpen, setTableOpen] = useState(false)
  const [guestsOpen, setGuestsOpen] = useState(false)
  const [time, setTime] = useState('19:00')
  const [guests, setGuests] = useState('2')
  const [comment, setComment] = useState('')
  const [remind, setRemind] = useState(true)
  const [timeOpen, setTimeOpen] = useState(false)
  const [phoneOpen, setPhoneOpen] = useState(false)
  // активное текстовое поле под сенсорную клавиатуру
  const [edit, setEdit] = useState<{ title: React.ReactNode; value: string; set: (v: string) => void } | null>(null)

  const no = banquets.length + 1
  const hallName = (id: string) => halls.find((h) => h.id === id)?.name ?? ''
  const tableNo = (id: string) => tablesByHall(hallId).find((t) => t.id === id)?.no ?? ''
  const save = () => {
    if (!firstName || !time) { alert('Заполните имя и время'); return }
    const fHall = hallId || halls[0].id
    const fTable = tableId || tablesByHall(fHall)[0].id
    addBanquet({
      type, hallId: fHall, tableId: fTable, date: 'Сегодня', time,
      guests: parseInt(guests, 10) || 1,
      clientName: [firstName, lastName].filter(Boolean).join(' '),
      clientPhone: phone, comment, prepayment: 0,
    })
    navigate('/banquets')
  }

  // строка-поле КЛИЕНТ: метка слева + значение справа (розовый = обязательное)
  const Field = ({ label, req, children }: { label: React.ReactNode; req?: boolean; children: React.ReactNode }) => (
    <div className="flex border border-gray-300 -mt-px first:mt-0">
      <div className={`w-40 px-3 flex items-center justify-end text-right text-gray-600 ${req ? 'bg-[#ece0e0]' : 'bg-gray-100'}`}>{label}</div>
      <div className={`flex-1 ${req ? 'bg-[#f5d2d2]' : 'bg-white'}`}>{children}</div>
    </div>
  )
  const inp = 'w-full h-14 px-3 bg-transparent outline-none text-gray-800'
  // тап-поле под текст: открывает сенсорную клавиатуру (TextInputModal)
  const TextBtn = ({ title, value, set, placeholder }: { title: React.ReactNode; value: string; set: (v: string) => void; placeholder?: string }) => (
    <button onClick={() => setEdit({ title, value, set })} className={`${inp} text-left ${value ? '' : 'text-gray-400'}`}>
      {value || placeholder || ''}
    </button>
  )
  const Info = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="border border-gray-300 -ml-px -mt-px bg-white p-3 text-center">
      <div className="text-gray-500 text-sm">{label}</div>
      <div className="text-gray-800">{children}</div>
    </div>
  )

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      {/* шапка: № + время | статус | меню/замок */}
      <div className="h-16 bg-white text-gray-800 flex items-center px-4 shrink-0">
        <div>
          <div className="text-lg font-semibold">{type} № {no}</div>
          <div className="text-sm text-gray-500">{time} (Сегодня)</div>
        </div>
        <div className="mx-auto text-lg text-gray-800">Статус: <b>Новый</b></div>
        <div className="flex items-center gap-4 text-gray-700">
          <button onClick={() => navigate('/menu')}><Menu size={22} /></button>
          <button onClick={() => { logout(); navigate('/') }}><Lock size={18} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 pr-10 flex gap-8 justify-end items-start">
        {/* КЛИЕНТ */}
        <div className="w-[440px]">
          <div className="text-center text-white/70 tracking-widest mb-2">КЛИЕНТ</div>
          <div>
            <Field label={<span>Имя<br />Отчество</span>} req>
              <TextBtn title={'Имя\nОтчество'} value={firstName} set={setFirstName} />
            </Field>
            <Field label="Фамилия"><TextBtn title="Фамилия" value={lastName} set={setLastName} /></Field>
            <Field label="Телефон" req><button onClick={() => setPhoneOpen(true)} className={`${inp} text-left ${phone.trim() === '+7' ? 'text-gray-400' : ''}`}>{phone || '+7'}</button></Field>
            <Field label="Карта"><TextBtn title="Карта" value={card} set={setCard} placeholder="прокатать / ввести" /></Field>
            <Field label="Прочее"><TextBtn title="Прочее" value={other} set={setOther} /></Field>
          </div>
          <button onClick={() => setEdit({ title: 'Дополнительная информация', value: extra, set: setExtra })}
            className={`w-full h-14 mt-2 px-3 rounded bg-white text-center outline-none border border-gray-300 ${extra ? 'text-gray-800' : 'text-gray-400'}`}>
            {extra || 'Дополнительная информация'}
          </button>
          <div className="flex gap-2 mt-2">
            <button className="flex-1 h-16 rounded bg-[#4a4f55] text-white text-sm">Без скидки/<br />ценовой категории</button>
            <button className="flex-1 h-16 rounded bg-white text-gray-700 text-sm">Не в статусе<br />«высокий риск»</button>
          </div>
        </div>

        {/* БАНКЕТ / РЕЗЕРВ */}
        <div className="w-[440px]">
          <div className="text-center text-white/70 tracking-widest mb-2">{type === 'Банкет' ? 'БАНКЕТ' : 'РЕЗЕРВ'}</div>
          <div className="grid grid-cols-2">
            <Info label="Дата:">10 июня 2026 г.</Info>
            <Info label="Время:"><button onClick={() => setTimeOpen(true)} className="w-full text-center text-gray-800 underline underline-offset-2 decoration-dotted">{time}</button></Info>
            <Info label="Длительность:">02:00</Info>
            <Info label="Гостей:"><button onClick={() => setGuestsOpen(true)} className="w-full text-center text-gray-800">{guests}</button></Info>
          </div>
          <div className="flex border border-gray-300 -mt-px">
            <div className="w-32 px-3 flex items-center justify-end text-right text-gray-600 bg-[#ece0e0]">Залы<br />Столы</div>
            <button onClick={() => setTableOpen(true)} className="flex-1 bg-[#f5d2d2] text-left px-3 h-14 text-gray-800">
              {hallId && tableId ? `${hallName(hallId)}: ${tableNo(tableId)}` : ''}
            </button>
          </div>
          <div className="flex border border-gray-300 -mt-px">
            <div className="w-32 px-3 flex items-center justify-end text-right text-gray-600 bg-gray-100">Коммент.</div>
            <div className="flex-1 bg-white"><TextBtn title="Комментарий" value={comment} set={setComment} /></div>
          </div>

          {/* действия 2×2 */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => setRemind((v) => !v)} className={`h-16 rounded text-sm font-semibold ${remind ? 'bg-pos-accent text-gray-900' : 'bg-white/10 text-white'}`}>НАПОМНИТЬ ЗАРАНЕЕ</button>
            <button className="h-16 rounded bg-white/20 text-white/70 text-sm">ПЕЧАТЬ ТАБЛИЧКИ «RESERVED»</button>
            <button disabled className="h-16 rounded bg-white/10 text-white/30 text-sm">Гость пришёл</button>
            <button disabled className="h-16 rounded bg-white/10 text-white/30 text-sm">Снять {type === 'Банкет' ? 'банкет' : 'резерв'}</button>
          </div>
        </div>
      </div>

      {/* нижняя панель */}
      <div className="h-20 bg-[#1a1a1a] flex items-center px-4 gap-4 shrink-0">
        <button onClick={() => navigate('/banquets')} className="flex flex-col items-center gap-0.5 text-[11px]"><ChevronLeft size={24} />НАЗАД</button>
        <button className="h-12 w-14 rounded bg-pos-accent text-gray-900 flex items-center justify-center"><Keyboard size={22} /></button>
        <button className="flex flex-col items-center gap-0.5 text-[11px]"><ClipboardList size={22} />ЗАКАЗ</button>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={save} className="h-12 px-10 rounded-md bg-pos-green text-white text-lg">Сохранить</button>
          <button onClick={() => navigate('/banquets')} className="h-12 px-10 rounded-md bg-white/10 text-white text-lg">Отмена</button>
        </div>
      </div>

      {timeOpen && (
        <TimePickerModal
          value={time}
          onOk={(v) => { setTime(v); setTimeOpen(false) }}
          onCancel={() => setTimeOpen(false)}
        />
      )}
      {phoneOpen && (
        <PhonePadModal
          value={phone}
          onOk={(v) => { setPhone(v); setPhoneOpen(false) }}
          onCancel={() => setPhoneOpen(false)}
        />
      )}
      {edit && (
        <TextInputModal
          title={edit.title}
          value={edit.value}
          onOk={(v) => { edit.set(v); setEdit(null) }}
          onCancel={() => setEdit(null)}
        />
      )}
      {tableOpen && (
        <TableSelectModal
          hallId={hallId || null}
          tableId={tableId || null}
          onPick={(h, t) => { setHallId(h); setTableId(t); setTableOpen(false) }}
          onCancel={() => setTableOpen(false)}
        />
      )}
      {guestsOpen && (
        <GuestCountModal
          value={parseInt(guests, 10) || undefined}
          onOk={(n) => { setGuests(String(n)); setGuestsOpen(false) }}
          onCancel={() => setGuestsOpen(false)}
        />
      )}
    </div>
  )
}
