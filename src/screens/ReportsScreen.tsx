import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { usePos, lineTotal } from '../store/pos'
import { formatTenge, vatAmount } from '../lib/money'
import { printToast } from '../lib/print'
import { attendance } from '../mock/data'
import { dishCost } from '../mock/warehouse'
import TopBar from '../components/TopBar'
import type { ClosedOrder } from '../types'

// Отчёты на кассе (FRONT_03 §5.1) — полный список iikoFront по разделам.
// Все цифры считаются из закрытых заказов смены, движений наличных, возвратов, списаний и явок.
interface Rep { id: string; name: string }
const SECTIONS: { title: string; reports: Rep[] }[] = [
  {
    title: 'Отчёты по кассе (терминал, текущая смена)',
    reports: [
      { id: 'x', name: 'X-отчёт (без гашения)' },
      { id: '041', name: '041 Выручка по типам с налогами' },
      { id: '042', name: '042 Выручка почасовая' },
      { id: '043', name: '043 Продажи блюд' },
      { id: '044', name: '044 Расход блюд' },
      { id: '045', name: '045 Полный отчёт кассовой смены' },
      { id: '046', name: '046 Реестр счетов' },
      { id: '047', name: '047 Чеки по типам оплаты за смену' },
      { id: '048', name: '048 Итого по смене' },
      { id: '049', name: '049 Кассовая лента' },
      { id: '051', name: '051 Расширенный реестр счетов' },
      { id: '052', name: '052 По внесениям и изъятиям' },
      { id: '054', name: '054 По чаевым' },
    ],
  },
  {
    title: 'Отчёты по выручке (все терминалы, операц. день)',
    reports: [
      { id: '011', name: '011 Общая выручка по типам с налогами' },
      { id: '012', name: '012 Общая выручка почасовая' },
      { id: '013', name: '013 Общая выручка по официантам' },
      { id: '016', name: '016 Чеки по типам оплаты' },
    ],
  },
  {
    title: 'Отчёты по расходу блюд',
    reports: [
      { id: '021', name: '021 Общий расход' },
      { id: '023', name: '023 Общие продажи' },
      { id: '024', name: '024 Общие списания' },
    ],
  },
  {
    title: 'Специальные',
    reports: [
      { id: '031', name: '031 Сводный' },
      { id: '032', name: '032 Питание персонала' },
      { id: '034', name: '034 Списания блюд' },
      { id: '035', name: '035 Явки' },
      { id: '036', name: '036 Скидки/надбавки' },
      { id: '037', name: '037 Опасные операции' },
      { id: '038', name: '038 Расчёт сотрудникам' },
    ],
  },
]

const hourOf = (o: ClosedOrder) => (o.paidAt.split(',')[1]?.trim() ?? '').slice(0, 2) || '—'
const timeOf = (o: ClosedOrder) => (o.paidAt.split(',')[1]?.trim() ?? o.paidAt).slice(0, 5)
const tableLabel = (o: ClosedOrder) => (o.tableId ? `стол ${o.tableId.replace(/^t-/, '')}` : 'на вынос')

export default function ReportsScreen() {
  const navigate = useNavigate()
  const { closedOrders, cashShift, cashMovements, refunds, writeOffs, ingredients } = usePos()
  const [sel, setSel] = useState('x')

  // ───────────────────────── агрегаты смены ─────────────────────────
  const count = closedOrders.length
  const revenue = closedOrders.reduce((s, o) => s + o.total, 0)
  const vat = vatAmount(revenue, 16)
  const net = +(revenue - vat).toFixed(2)
  const avg = count ? +(revenue / count).toFixed(2) : 0
  const guests = closedOrders.reduce((s, o) => s + o.guests, 0)

  const byType: Record<string, { sum: number; count: number }> = {}
  closedOrders.forEach((o) => o.payments.forEach((p) => {
    const t = (byType[p.name] ??= { sum: 0, count: 0 }); t.sum += p.amount; t.count += 1
  }))
  const byWaiter: Record<string, { sum: number; count: number; tip: number }> = {}
  closedOrders.forEach((o) => {
    const w = (byWaiter[o.waiter] ??= { sum: 0, count: 0, tip: 0 })
    w.sum += o.total; w.count += 1; w.tip += o.tip ?? 0
  })
  const byHour: Record<string, { sum: number; count: number }> = {}
  closedOrders.forEach((o) => { const h = (byHour[hourOf(o)] ??= { sum: 0, count: 0 }); h.sum += o.total; h.count += 1 })

  const dishAgg: Record<string, { name: string; qty: number; sum: number; cost: number }> = {}
  closedOrders.forEach((o) => o.lines.forEach((l) => {
    const a = (dishAgg[l.dishId] ??= { name: l.name, qty: 0, sum: 0, cost: 0 })
    a.qty += l.qty; a.sum += lineTotal(l); a.cost += dishCost(l.dishId, ingredients) * l.qty
  }))
  const dishList = Object.values(dishAgg).sort((a, b) => b.sum - a.sum)
  const costTotal = +dishList.reduce((s, d) => s + d.cost, 0).toFixed(2)
  const grossProfit = +(net - costTotal).toFixed(2)
  const soldQty = dishList.reduce((s, d) => s + d.qty, 0)

  const discountsSum = +closedOrders.reduce((s, o) => {
    const sub = o.lines.reduce((x, l) => x + lineTotal(l), 0)
    return s + Math.max(0, sub - o.total)
  }, 0).toFixed(2)
  const discounted = closedOrders.filter((o) => o.discountPct > 0)

  const tipsTotal = +closedOrders.reduce((s, o) => s + (o.tip ?? 0), 0).toFixed(2)
  const refundsSum = +refunds.reduce((s, r) => s + r.amount, 0).toFixed(2)

  const cashIn = cashMovements.filter((m) => m.kind === 'in').reduce((s, m) => s + m.amount, 0)
  const cashOut = cashMovements.filter((m) => m.kind === 'out').reduce((s, m) => s + m.amount, 0)
  const cashPaid = closedOrders.reduce((s, o) => s + o.payments.filter((p) => p.paymentTypeId === 'p-cash').reduce((x, p) => x + p.amount, 0), 0)
  const cashInDrawer = +(cashIn + cashPaid - cashOut - refundsSum).toFixed(2)

  const staffMeals = closedOrders.filter((o) => o.staffMeal)
  const staffMealsSum = +staffMeals.reduce((s, o) => s + o.total, 0).toFixed(2)
  const writeOffsSum = +writeOffs.reduce((s, w) => s + w.cost, 0).toFixed(2)
  const salaryMv = cashMovements.filter((m) => m.kind === 'out' && /зарплат/i.test(m.type))

  const repName = SECTIONS.flatMap((s) => s.reports).find((r) => r.id === sel)?.name ?? ''
  const noData = count === 0

  // ───────────────────────── рендер тела отчёта ─────────────────────────
  const body = () => {
    if (noData && !['035'].includes(sel)) return <Empty text="— за смену нет чеков (сгенерируйте демо-данные) —" />
    switch (sel) {
      case 'x':
        return <>
          <Row k="Чеков закрыто" v={String(count)} />
          <Row k="Гостей" v={String(guests)} />
          <Row k="Выручка" v={formatTenge(revenue)} b />
          <Row k="в т.ч. ҚҚС 16%" v={formatTenge(vat)} />
          <Row k="Средний чек" v={formatTenge(avg)} />
          <Block title="По типам оплаты">{typeRows()}</Block>
          <Block title="Касса">
            <Row k="Внесения" v={formatTenge(cashIn)} />
            <Row k="Изъятия" v={'− ' + formatTenge(cashOut)} />
            <Row k="Возвраты" v={'− ' + formatTenge(refundsSum)} />
            <Row k="Наличных в ящике" v={formatTenge(cashInDrawer)} b />
          </Block>
        </>
      case '041': case '011':
        return <>
          {typeTaxRows()}
          <Hr />
          <Row k="ИТОГО выручка" v={formatTenge(revenue)} b />
          <Row k="в т.ч. ҚҚС 16%" v={formatTenge(vat)} />
          <Row k="без НДС" v={formatTenge(net)} />
        </>
      case '042': case '012':
        return <>
          <div className="text-gray-500">Час · чеков · выручка</div>
          {Object.entries(byHour).sort().map(([h, v]) => <Row key={h} k={`${h}:00  (${v.count} чек.)`} v={formatTenge(v.sum)} />)}
          <Hr /><Row k="ИТОГО" v={formatTenge(revenue)} b />
        </>
      case '043': case '023':
        return <>
          <div className="text-gray-500">Блюдо · кол-во · сумма</div>
          {dishList.map((d) => <Row key={d.name} k={`${d.name} ×${d.qty}`} v={formatTenge(d.sum)} />)}
          <Hr /><Row k={`ИТОГО (${soldQty} шт)`} v={formatTenge(revenue)} b />
        </>
      case '044': case '021':
        return <>
          <div className="text-gray-500">Блюдо · кол-во · себестоимость</div>
          {dishList.map((d) => <Row key={d.name} k={`${d.name} ×${d.qty}`} v={formatTenge(d.cost)} />)}
          {writeOffs.length > 0 && <><div className="text-gray-500 mt-1">Списания:</div>
            {writeOffs.map((w) => <Row key={w.id} k={`${w.name} ×${w.qty}`} v={formatTenge(w.cost)} />)}</>}
          <Hr /><Row k={`Расход блюд (${soldQty} шт)`} v={formatTenge(costTotal)} b />
        </>
      case '045':
        return <>
          <Row k="Чеков / гостей" v={`${count} / ${guests}`} />
          <Row k="Выручка" v={formatTenge(revenue)} b />
          <Row k="в т.ч. ҚҚС 16%" v={formatTenge(vat)} />
          <Row k="Средний чек" v={formatTenge(avg)} />
          <Block title="По типам оплаты">{typeRows()}</Block>
          <Block title="Топ блюд">{dishList.slice(0, 6).map((d) => <Row key={d.name} k={`${d.name} ×${d.qty}`} v={formatTenge(d.sum)} />)}</Block>
          <Block title="Себестоимость / прибыль">
            <Row k="Себестоимость" v={formatTenge(costTotal)} />
            <Row k="Валовая прибыль" v={formatTenge(grossProfit)} b />
          </Block>
          <Block title="Прочее">
            <Row k="Скидки" v={formatTenge(discountsSum)} />
            <Row k="Чаевые" v={formatTenge(tipsTotal)} />
            <Row k="Возвраты" v={'− ' + formatTenge(refundsSum)} />
            <Row k="Наличных в ящике" v={formatTenge(cashInDrawer)} />
          </Block>
        </>
      case '046':
        return <>
          <div className="text-gray-500">№ · время · сумма · оплата</div>
          {closedOrders.map((o) => <Row key={o.fiscalDocNo} k={`№${o.id} · ${timeOf(o)} · ${o.payments.map((p) => short(p.name)).join('+')}`} v={formatTenge(o.total)} />)}
          <Hr /><Row k={`Счетов: ${count}`} v={formatTenge(revenue)} b />
        </>
      case '051':
        return <>
          {closedOrders.map((o) => (
            <div key={o.fiscalDocNo} className="border-b border-dashed py-1">
              <div className="flex justify-between"><span>№{o.id} · {timeOf(o)}</span><span className="font-bold">{formatTenge(o.total)}</span></div>
              <div className="text-xs text-gray-500">{o.waiter} · {tableLabel(o)} · {o.guests} гост. · {o.payments.map((p) => p.name).join(', ')} · ФД {o.fiscalDocNo}</div>
            </div>
          ))}
          <Row k={`Счетов: ${count}`} v={formatTenge(revenue)} b />
        </>
      case '047': case '016':
        return <>
          <div className="text-gray-500">Тип оплаты · чеков · сумма</div>
          {Object.entries(byType).map(([k, v]) => <Row key={k} k={`${k} (${v.count})`} v={formatTenge(v.sum)} />)}
          <Hr /><Row k="ИТОГО" v={formatTenge(revenue)} b />
        </>
      case '048':
        return <>
          <Row k="Выручка" v={formatTenge(revenue)} b />
          <Row k="в т.ч. ҚҚС 16%" v={formatTenge(vat)} />
          <Row k="Выручка без НДС" v={formatTenge(net)} />
          <Row k="Чеков" v={String(count)} />
          <Row k="Гостей" v={String(guests)} />
          <Row k="Средний чек" v={formatTenge(avg)} />
          <Hr />
          <Row k="Себестоимость" v={formatTenge(costTotal)} />
          <Row k="Валовая прибыль" v={formatTenge(grossProfit)} b />
        </>
      case '049': {
        const tape = [
          ...closedOrders.map((o) => ({ t: timeOf(o), k: `Чек №${o.id} · ${short(o.payments[0]?.name ?? '')}`, v: formatTenge(o.total) })),
          ...refunds.map((r) => ({ t: (r.at.split(',')[1] ?? '').trim().slice(0, 5), k: `Возврат №${r.orderId}`, v: '− ' + formatTenge(r.amount) })),
          ...cashMovements.map((m) => ({ t: (m.at.split(',')[1] ?? '').trim().slice(0, 5), k: `${m.kind === 'in' ? 'Внесение' : 'Изъятие'}: ${m.type}`, v: (m.kind === 'in' ? '+ ' : '− ') + formatTenge(m.amount) })),
        ].sort((a, b) => a.t.localeCompare(b.t))
        return <>{tape.map((x, i) => <Row key={i} k={`${x.t}  ${x.k}`} v={x.v} />)}</>
      }
      case '052':
        return <>
          {cashMovements.length === 0 && <Empty />}
          {cashMovements.map((m) => <Row key={m.id} k={`${m.kind === 'in' ? '+ ' : '− '}${m.type}`} v={formatTenge(m.amount)} />)}
          <Hr />
          <Row k="Внесено" v={formatTenge(cashIn)} />
          <Row k="Изъято" v={'− ' + formatTenge(cashOut)} b />
          {refunds.length > 0 && <Block title="Возвраты">{refunds.map((r) => <Row key={r.id} k={`Возврат №${r.orderId}${r.full ? ' (полн.)' : ' (част.)'}`} v={'− ' + formatTenge(r.amount)} />)}</Block>}
        </>
      case '054':
        return <>
          {tipsTotal === 0 && <Empty text="— чаевых за смену нет —" />}
          {tipsTotal > 0 && <>
            <Block title="По официантам">
              {Object.entries(byWaiter).filter(([, v]) => v.tip > 0).map(([k, v]) => <Row key={k} k={k} v={formatTenge(v.tip)} />)}
            </Block>
            <Hr /><Row k="Чаевые всего" v={formatTenge(tipsTotal)} b />
          </>}
        </>
      case '013':
        return <>
          <div className="text-gray-500">Официант · чеков · выручка · чаевые</div>
          {Object.entries(byWaiter).map(([k, v]) => <Row key={k} k={`${k} (${v.count})`} v={`${formatTenge(v.sum)}${v.tip ? '  +чай ' + formatTenge(v.tip) : ''}`} />)}
          <Hr /><Row k="ИТОГО" v={formatTenge(revenue)} b />
        </>
      case '024': case '034':
        return <>
          {writeOffs.length === 0 && <Empty text="— списаний за смену нет —" />}
          {writeOffs.map((w) => <Row key={w.id} k={`${w.name} ×${w.qty} · ${w.reason}`} v={formatTenge(w.cost)} />)}
          {writeOffs.length > 0 && <><Hr /><Row k="Списано (себестоимость)" v={formatTenge(writeOffsSum)} b /></>}
        </>
      case '031':
        return <>
          <Row k="Выручка" v={formatTenge(revenue)} b />
          <Row k="в т.ч. ҚҚС 16%" v={formatTenge(vat)} />
          <Row k="Чеков / гостей" v={`${count} / ${guests}`} />
          <Row k="Средний чек" v={formatTenge(avg)} />
          <Hr />
          <Row k="Себестоимость" v={formatTenge(costTotal)} />
          <Row k="Валовая прибыль" v={formatTenge(grossProfit)} b />
          <Hr />
          <Row k="Скидки" v={formatTenge(discountsSum)} />
          <Row k="Чаевые" v={formatTenge(tipsTotal)} />
          <Row k="Списания" v={formatTenge(writeOffsSum)} />
          <Row k="Возвраты" v={'− ' + formatTenge(refundsSum)} />
          <Row k="Питание персонала" v={formatTenge(staffMealsSum)} />
        </>
      case '032':
        return <>
          {staffMeals.length === 0 && <Empty text="— питания персонала за смену нет —" />}
          {staffMeals.map((o) => <Row key={o.fiscalDocNo} k={`№${o.id} · ${o.waiter} · ${timeOf(o)}`} v={formatTenge(o.total)} />)}
          {staffMeals.length > 0 && <><Hr /><Row k={`Заказов: ${staffMeals.length}`} v={formatTenge(staffMealsSum)} b /></>}
        </>
      case '035':
        return <>
          <div className="text-gray-500">Сотрудник · приход · уход · статус</div>
          {attendance.map((a, i) => <Row key={i} k={`${a.staff} · ${a.position}`} v={`${a.in || '—'} / ${a.out || '—'} · ${a.type}`} />)}
        </>
      case '036':
        return <>
          {discounted.length === 0 && <Empty text="— скидок/надбавок за смену нет —" />}
          {discounted.map((o) => <Row key={o.fiscalDocNo} k={`№${o.id} · ${o.waiter} · −${o.discountPct}%`} v={formatTenge(o.total)} />)}
          {discounted.length > 0 && <><Hr /><Row k={`Заказов со скидкой: ${discounted.length}`} v={'− ' + formatTenge(discountsSum)} b /></>}
        </>
      case '037':
        return <>
          <Block title="Возвраты">
            {refunds.length === 0 && <Empty text="— нет —" />}
            {refunds.map((r) => <Row key={r.id} k={`Возврат №${r.orderId}${r.full ? ' (полн.)' : ' (част.)'} · ${r.by}`} v={'− ' + formatTenge(r.amount)} />)}
          </Block>
          <Block title="Изъятия из кассы">
            {cashMovements.filter((m) => m.kind === 'out').map((m) => <Row key={m.id} k={m.type} v={'− ' + formatTenge(m.amount)} />)}
          </Block>
          <Block title="Списания блюд">
            {writeOffs.map((w) => <Row key={w.id} k={`${w.name} ×${w.qty} · ${w.reason}`} v={formatTenge(w.cost)} />)}
          </Block>
          <Block title="Ручные скидки">
            {discounted.length === 0 && <Empty text="— нет —" />}
            {discounted.map((o) => <Row key={o.fiscalDocNo} k={`№${o.id} · −${o.discountPct}%`} v={formatTenge(o.total)} />)}
          </Block>
        </>
      case '038':
        return <>
          <Block title="Выплаты из кассы">
            {salaryMv.length === 0 && <Empty text="— выплат не было —" />}
            {salaryMv.map((m) => <Row key={m.id} k={`${m.comment || m.type}`} v={'− ' + formatTenge(m.amount)} />)}
          </Block>
          <Block title="Чаевые к выдаче">
            {Object.entries(byWaiter).filter(([, v]) => v.tip > 0).map(([k, v]) => <Row key={k} k={k} v={formatTenge(v.tip)} />)}
            {tipsTotal === 0 && <Empty text="— нет —" />}
          </Block>
        </>
      default:
        return <Empty />
    }
  }

  const typeRows = () => Object.entries(byType).map(([k, v]) => <Row key={k} k={`${k} (${v.count})`} v={formatTenge(v.sum)} />)
  const typeTaxRows = () => Object.entries(byType).map(([k, v]) => (
    <div key={k} className="py-0.5">
      <div className="flex justify-between"><span>{k}</span><span>{formatTenge(v.sum)}</span></div>
      <div className="flex justify-between text-xs text-gray-500"><span>в т.ч. ҚҚС 16% / без НДС</span><span>{formatTenge(vatAmount(v.sum, 16))} / {formatTenge(v.sum - vatAmount(v.sum, 16))}</span></div>
    </div>
  ))

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Отчёты на кассе" />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 bg-black/30 overflow-auto">
          {SECTIONS.map((sec) => (
            <div key={sec.title}>
              <div className="px-3 py-2 text-xs uppercase text-pos-accent bg-black/40 sticky top-0">{sec.title}</div>
              {sec.reports.map((r) => (
                <button key={r.id} onClick={() => setSel(r.id)}
                  className={`w-full text-left px-4 h-11 border-b border-white/10 text-sm ${sel === r.id ? 'bg-pos-blue' : 'hover:bg-white/5'}`}>{r.name}</button>
              ))}
            </div>
          ))}
        </div>

        <div className="flex-1 p-6 overflow-auto">
          <div className="bg-white text-gray-800 rounded-lg p-6 max-w-md mx-auto font-mono text-sm">
            <div className="text-center font-bold">{repName.replace(/^\d+\s/, '')}</div>
            <div className="text-center text-xs text-gray-500 mb-3">
              Терминал №998 · Кассовая смена №{cashShift?.no ?? '—'}<br />KZ ҚҚС 16% · {cashShift?.openedAt?.split(',')[0] ?? ''}
            </div>
            {body()}
            <div className="text-center text-xs text-gray-400 mt-3 border-t pt-2">
              {sel === 'x' ? 'X-отчёт — без гашения счётчика' : 'Отчёт за текущую кассовую смену'}
            </div>
          </div>
        </div>
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4 gap-4">
        <BackButton onClick={() => navigate('/menu')} />
        <button onClick={() => printToast(`Отчёт «${repName}» распечатан`)} className="ml-auto h-12 px-8 rounded-md bg-pos-blue text-white">Печать</button>
      </div>
    </div>
  )
}

const short = (name: string) => name.replace('Наличные', 'Нал').replace('Банковские карты', 'Карта').replace('Безналичный расчёт', 'Безнал').replace('Без выручки', 'Б/в').replace('Бонусная карта', 'Бонус')

const Row = ({ k, v, b }: { k: string; v: string; b?: boolean }) => (
  <div className={`flex justify-between py-0.5 gap-3 ${b ? 'font-bold' : ''}`}><span>{k}</span><span className="whitespace-nowrap">{v}</span></div>
)
const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <><div className="border-t border-dashed my-2" /><div className="text-gray-500">{title}:</div>{children}</>
)
const Hr = () => <div className="border-t border-dashed my-2" />
const Empty = ({ text = '— нет данных —' }: { text?: string }) => <div className="text-gray-400">{text}</div>
