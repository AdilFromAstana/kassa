import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { usePos } from '../store/pos'
import { formatTenge } from '../lib/money'
import { printToast } from '../lib/print'
import TopBar from '../components/TopBar'

// Чек коррекции (FRONT_01/FRONT_03): исправление сумм для налоговой. KZ ставки 16%/0%, СНО ОУР/СНР, Webkassa.
const signs = ['Коррекция прихода', 'Коррекция возврата прихода', 'Коррекция расхода', 'Коррекция возврата расхода']
const corrTypes = ['Самостоятельная', 'По предписанию']
const taxModes = ['ОУР (общеустановленный)', 'СНР (упрощёнка)']

export default function CorrectionScreen() {
  const navigate = useNavigate()
  const { fiscalSeq } = usePos()
  const [sign, setSign] = useState(signs[0])
  const [corr, setCorr] = useState(corrTypes[0])
  const [tax, setTax] = useState(taxModes[0])
  const [docNo, setDocNo] = useState('')
  const [date, setDate] = useState('')
  const [cash, setCash] = useState('')
  const [card, setCard] = useState('')
  const [vat, setVat] = useState<16 | 0>(16)

  const total = (parseFloat(cash) || 0) + (parseFloat(card) || 0)

  const print = () => {
    if (total <= 0) { alert('Укажите сумму'); return }
    printToast(`Чек коррекции отправлен через ОФД (Webkassa)\nФД №${fiscalSeq + 1} · ${sign}\nСумма: ${formatTenge(total)} · ҚҚС ${vat}%`)
    navigate('/menu')
  }

  const field = (label: string, node: React.ReactNode) => (
    <label className="flex flex-col gap-1"><span className="text-sm text-white/60">{label}</span>{node}</label>
  )
  const inputCls = 'h-11 rounded-md px-3 bg-white text-gray-800'
  const selCls = 'h-11 rounded-md px-2 bg-white text-gray-800'

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Чек коррекции" />
      <div className="bg-white/5 text-white/50 text-xs px-6 py-2">
        Фискальная коррекция сумм для налоговой (KZ, Webkassa). Это <b>не возврат гостю</b> — для возврата оплаты используйте «Возврат товаров» → закрытые заказы / архив смен.
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 gap-4 max-w-3xl">
          {field('Признак расчёта', <select className={selCls} value={sign} onChange={(e) => setSign(e.target.value)}>{signs.map((s) => <option key={s}>{s}</option>)}</select>)}
          {field('Тип коррекции', <select className={selCls} value={corr} onChange={(e) => setCorr(e.target.value)}>{corrTypes.map((s) => <option key={s}>{s}</option>)}</select>)}
          {field('Тип системы налогообложения', <select className={selCls} value={tax} onChange={(e) => setTax(e.target.value)}>{taxModes.map((s) => <option key={s}>{s}</option>)}</select>)}
          {field('Ставка ҚҚС', (
            <div className="flex gap-2">
              {([16, 0] as const).map((r) => (
                <button key={r} onClick={() => setVat(r)} className={`flex-1 h-11 rounded-md ${vat === r ? 'bg-pos-accent text-black' : 'bg-white/10'}`}>{r}%</button>
              ))}
            </div>
          ))}
          {field('Дата документа-основания', <input className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} placeholder="дд.мм.гггг" />)}
          {field('Номер документа-основания', <input className={inputCls} value={docNo} onChange={(e) => setDocNo(e.target.value)} placeholder="напр. 001-01062026" />)}
          {field('Наличными, ₸', <input className={inputCls} value={cash} onChange={(e) => setCash(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" />)}
          {field('Электронными (карта), ₸', <input className={inputCls} value={card} onChange={(e) => setCard(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" />)}
        </div>
        <div className="mt-4 text-lg">Итого коррекция: <b>{formatTenge(total)}</b></div>
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4 gap-4">
        <BackButton onClick={() => navigate('/menu')} />
        <button onClick={print} className="ml-auto h-12 px-10 rounded-md bg-pos-green text-white">Печать</button>
      </div>
    </div>
  )
}
