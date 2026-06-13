import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { usePos, lineTotal } from '../store/pos'
import { formatTenge, vatAmount } from '../lib/money'
import { printToast, toast } from '../lib/print'
import ReportParamsModal from '../components/ReportParamsModal'
import { attendance, halls } from '../mock/data'
import { dishCost } from '../mock/warehouse'
import TopBar from '../components/TopBar'
import type { ClosedOrder } from '../types'

// Отчёты на кассе (FRONT_03 §5.1) — полный список iikoFront по разделам.
// Все цифры считаются из закрытых заказов смены, движений наличных, возвратов, списаний и явок.
interface Rep { id: string; name: string }
// Список 1:1 с iikoFront: секции по первой паре цифр номера, порядок
// 01 Выручка → 02 Расход блюд → 03 Специальные → 04 Касса (в конце).
// Источники: реальные скрины экрана «Отчёты» + iikoFront API (номера/названия 015/033/039/050/052/053/054).
const SECTIONS: { title: string; noParams?: boolean; reports: Rep[] }[] = [
  {
    title: '01 Отчёты по выручке',
    reports: [
      { id: '011', name: '011 Общая выручка по типам с налогами' },
      { id: '012', name: '012 Общая выручка почасовая' },
      { id: '013', name: '013 Общая выручка по официантам' },
      { id: '015', name: '015 Краткий отчёт по открытым заказам и продажам в разрезе залов' },
      { id: '016', name: '016 Чеки по типам оплаты' },
    ],
  },
  {
    title: '02 Отчёты по расходу блюд',
    reports: [
      { id: '021', name: '021 Общий расход блюд' },
      { id: '023', name: '023 Общие продажи блюд' },
      { id: '024', name: '024 Общие списания блюд' },
    ],
  },
  {
    title: '03 Специальные отчёты',
    reports: [
      { id: '031', name: '031 Сводный отчёт' },
      { id: '032', name: '032 Питание персонала' },
      { id: '033', name: '033 Время от пречека до оплаты' },
      { id: '034', name: '034 Списания блюд' },
      { id: '035', name: '035 Явки сотрудников' },
      { id: '036', name: '036 Отчёт по скидкам и надбавкам' },
      { id: '037', name: '037 Опасные операции' },
      { id: '038', name: '038 Расчёт сотрудникам' },
      { id: '039', name: '039 Отчёт по вскрытиям тары' },
    ],
  },
  {
    // Отчёты по текущему терминалу/кассовой смене — привязаны к смене, без окна «Параметры».
    title: '04 Отчёты по кассе',
    noParams: true,
    reports: [
      { id: '041', name: '041 Выручка по типам с налогами' },
      { id: '042', name: '042 Выручка почасовая' },
      { id: '043', name: '043 Продажи блюд' },
      { id: '044', name: '044 Расход блюд' },
      { id: '045', name: '045 Полный отчёт кассовой смены' },
      { id: '046', name: '046 Реестр счетов' },
      { id: '047', name: '047 Чеки по типам оплаты за смену' },
      { id: '048', name: '048 Итого по смене' },
      { id: '049', name: '049 Кассовая лента' },
      { id: '050', name: '050 Отчёт по доставкам' },
      { id: '051', name: '051 Расширенный реестр счетов' },
      { id: '052', name: '052 Отчёт по внесениям и изъятиям' },
      { id: '053', name: '053 Блюда для приготовления доставок' },
      { id: '054', name: '054 Отчёт по чаевым' },
    ],
  },
]

// «Параметры» (период) активны для отчётов 01–03 (выручка/расход/специальные).
// Отчёты по кассе (04, noParams) привязаны к текущей смене → кнопка неактивна (как в оригинале).
const NO_PARAM_IDS = new Set(SECTIONS.filter((s) => s.noParams).flatMap((s) => s.reports).map((r) => r.id))

const hourOf = (o: ClosedOrder) => (o.paidAt.split(',')[1]?.trim() ?? '').slice(0, 2) || '—'
const timeOf = (o: ClosedOrder) => (o.paidAt.split(',')[1]?.trim() ?? o.paidAt).slice(0, 5)
const tableLabel = (o: ClosedOrder) => (o.tableId ? `стол ${o.tableId.replace(/^t-/, '')}` : 'на вынос')

export default function ReportsScreen() {
  const navigate = useNavigate()
  const { closedOrders: allClosed, orders: openOrders, cashShift, cashMovements, refunds, writeOffs, ingredients } = usePos()
  const [sel, setSel] = useState('011')
  const [showParams, setShowParams] = useState(false)
  const [period, setPeriod] = useState(() => { const d = new Date(); return { from: d, to: d } })
  const [fHall, setFHall] = useState('')   // фильтр по залу ('' = все)
  const [fWaiter, setFWaiter] = useState('') // фильтр по официанту ('' = все)
  const hasParams = !NO_PARAM_IDS.has(sel)
  const fmtShort = (d: Date) => d.toLocaleDateString('ru-RU')

  // фильтры зал/официант применяются к продажам (как в iikoFront «Параметры → Зал/Официант»)
  const hallName = (id: string | null) => halls.find((h) => h.id === id)?.name ?? '—'
  const waiters = Array.from(new Set(allClosed.map((o) => o.waiter)))
  const closedOrders = allClosed.filter((o) => (!fHall || o.hallId === fHall) && (!fWaiter || o.waiter === fWaiter))

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
    if (noData && !['035', '015', '039'].includes(sel)) return <Empty text="— за смену нет чеков (сгенерируйте демо-данные) —" />
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
      case '015': {
        // краткий отчёт: открытые заказы и продажи в разрезе залов
        const rows = halls.map((h) => {
          const open = openOrders.filter((o) => o.hallId === h.id)
          const openSum = open.reduce((s, o) => s + o.lines.reduce((x, l) => x + lineTotal(l), 0), 0)
          const sold = closedOrders.filter((o) => o.hallId === h.id)
          const soldSum = sold.reduce((s, o) => s + o.total, 0)
          return { name: h.name, openCount: open.length, openSum, soldCount: sold.length, soldSum }
        })
        const openTotal = rows.reduce((s, r) => s + r.openSum, 0)
        return <>
          <div className="text-gray-500">Зал · открытые (сумма) · продажи (сумма)</div>
          {rows.map((r) => (
            <div key={r.name} className="py-0.5">
              <div className="flex justify-between"><span>{r.name}</span><span>{formatTenge(r.soldSum)}</span></div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>открытых: {r.openCount} ({formatTenge(r.openSum)}) · чеков: {r.soldCount}</span>
              </div>
            </div>
          ))}
          <Hr />
          <Row k="Открытые заказы (зал)" v={formatTenge(openTotal)} />
          <Row k="Продажи закрытые" v={formatTenge(revenue)} b />
        </>
      }
      case '039': {
        // вскрытие тары: проданные порционно напитки из тары (бутылки/кеги)
        const TARE = ['d-cola', 'd-water', 'd-beer', 'd-wine']
        const tare: Record<string, { name: string; qty: number }> = {}
        closedOrders.forEach((o) => o.lines.forEach((l) => {
          if (TARE.includes(l.dishId)) { const t = (tare[l.dishId] ??= { name: l.name, qty: 0 }); t.qty += l.qty }
        }))
        const list = Object.values(tare)
        const totalQty = list.reduce((s, t) => s + t.qty, 0)
        return <>
          {list.length === 0 && <Empty text="— вскрытий тары за смену нет —" />}
          {list.length > 0 && <>
            <div className="text-gray-500">Позиция (тара) · вскрыто</div>
            {list.map((t) => <Row key={t.name} k={t.name} v={`${t.qty} ед.`} />)}
            <Hr /><Row k="Всего вскрытий тары" v={`${totalQty} ед.`} b />
          </>}
        </>
      }
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
          {/* быстрые фильтры зал/официант (для отчётов по продажам) */}
          <div className="flex items-center justify-center gap-3 mb-4 text-sm">
            <span className="text-white/50">Зал:</span>
            <select value={fHall} onChange={(e) => setFHall(e.target.value)} className="h-9 rounded px-2 text-gray-800">
              <option value="">все</option>
              {halls.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <span className="text-white/50">Официант:</span>
            <select value={fWaiter} onChange={(e) => setFWaiter(e.target.value)} className="h-9 rounded px-2 text-gray-800">
              <option value="">все</option>
              {waiters.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            {(fHall || fWaiter) && <button onClick={() => { setFHall(''); setFWaiter('') }} className="h-9 px-3 rounded bg-white/10">Сбросить</button>}
          </div>
          <div className="bg-white text-gray-800 rounded-lg p-6 max-w-md mx-auto font-mono text-sm">
            {(fHall || fWaiter) && <div className="text-center text-xs text-pos-blue mb-2">Фильтр: {fHall ? hallName(fHall) : 'все залы'}{fWaiter ? ` · ${fWaiter}` : ''}</div>}
            <div className="text-center font-bold">{repName.replace(/^\d+\s/, '')}</div>
            <div className="text-center text-xs text-gray-500 mb-3">
              Терминал №998 · Кассовая смена №{cashShift?.no ?? '—'}<br />KZ ҚҚС 16% · {cashShift?.openedAt?.split(',')[0] ?? ''}
            </div>
            {body()}
            <div className="text-center text-xs text-gray-400 mt-3 border-t pt-2">
              {hasParams ? `Отчёт за период ${fmtShort(period.from)} — ${fmtShort(period.to)}` : 'Отчёт за текущую кассовую смену'}
            </div>
          </div>
        </div>
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4 gap-3">
        <BackButton onClick={() => navigate('/menu')} />
        <div className="ml-auto flex items-center gap-3">
          <button
            disabled={!hasParams}
            onClick={() => setShowParams(true)}
            title={hasParams ? 'Параметры отчёта' : 'У этого отчёта нет настраиваемых параметров'}
            className="h-12 px-6 rounded-md border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
          >
            Параметры
          </button>
          <button onClick={() => toast(`Отчёт «${repName}» обновлён`)} className="h-12 px-6 rounded-md border border-gray-300 hover:bg-gray-100">Обновить</button>
          <button onClick={() => toast(`Отчёт «${repName}» выгружен в Excel (.xlsx)`)} className="h-12 px-6 rounded-md border border-gray-300 hover:bg-gray-100">Excel…</button>
          <button onClick={() => printToast(`Отчёт «${repName}» распечатан`)} className="h-12 px-8 rounded-md bg-pos-blue text-white">Печать</button>
        </div>
      </div>

      {showParams && hasParams && (
        <ReportParamsModal
          title={repName}
          from={period.from}
          to={period.to}
          onOk={(from, to) => {
            setPeriod({ from, to })
            setShowParams(false)
            toast(`Отчёт «${repName}» сформирован за период\n${fmtShort(from)} — ${fmtShort(to)}`)
          }}
          onCancel={() => setShowParams(false)}
        />
      )}
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
