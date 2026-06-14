import { useState } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { usePos } from '../store/pos'
import { fiscalRegistrators } from '../mock/data'
import { formatTenge, vatAmount } from '../lib/money'
import { printToast } from '../lib/print'
import TopBar from '../components/TopBar'

// Команды фискальному регистратору (КАССА → Команды ФР). KZ ФР = Webkassa.
// X-отчёт — промежуточный, БЕЗ гашения (текущие итоги смены). Z-отчёт — сменный, С гашением (закрытие смены).
export default function FiscalCommandsScreen() {
  const navigate = useNavigate()
  const { cashShift, closedOrders, cashMovements, refunds, can } = usePos()
  const [fr, setFr] = useState(fiscalRegistrators[0].id)
  const [report, setReport] = useState<null | 'x' | 'z'>(null)
  const reg = fiscalRegistrators.find((f) => f.id === fr)!

  // ── агрегаты текущей смены (как в отчёте 048 «Итого по смене») ──
  const count = closedOrders.length
  const revenue = closedOrders.reduce((s, o) => s + o.total, 0)
  const vat = vatAmount(revenue, 16)
  const guests = closedOrders.reduce((s, o) => s + o.guests, 0)
  const avg = count ? +(revenue / count).toFixed(2) : 0
  const byType: Record<string, { sum: number; count: number }> = {}
  closedOrders.forEach((o) => o.payments.forEach((p) => { const t = (byType[p.name] ??= { sum: 0, count: 0 }); t.sum += p.amount; t.count += 1 }))
  const cashIn = cashMovements.filter((m) => m.kind === 'in').reduce((s, m) => s + m.amount, 0)
  const cashOut = cashMovements.filter((m) => m.kind === 'out').reduce((s, m) => s + m.amount, 0)
  // разменный фонд уже учтён движением-внесением в cashIn → показываем «Внесения» без него, фонд отдельной строкой (без двойного счёта)
  const fund = cashShift?.openingCash ?? 0
  const otherCashIn = +(cashIn - fund).toFixed(2)
  // для остатка в ящике учитываем только возвраты наличными (карточные ящика не касаются)
  const cashRefunds = +refunds.filter((r) => r.method !== 'card').reduce((s, r) => s + r.amount, 0).toFixed(2)
  const cashPaid = closedOrders.reduce((s, o) => s + o.payments.filter((p) => p.paymentTypeId === 'p-cash').reduce((x, p) => x + p.amount, 0), 0)
  const cashInDrawer = +(cashIn + cashPaid - cashOut - cashRefunds).toFixed(2)

  const [showJournal, setShowJournal] = useState(false)
  const unsentOfd = 0 // непереданных в ОФД (мок: онлайн-режим). Реальное значение — с драйвера Webkassa.

  const cmd = (label: string, result: string) => ({ label, result })
  const commands = [
    cmd('Состояние ФР', `${reg.model} · ФН ${reg.fn} · смена ${reg.shiftOpen ? 'открыта' : 'закрыта'}`),
    cmd('Снять показания ФН', `Показания ФН ${reg.fn}: чеков за смену ${count}, выручка ${formatTenge(revenue)} (без гашения)`),
    cmd('Синхронизация с ОФД', `Синхронизация с ОФД РК выполнена · непереданных чеков: ${unsentOfd}`),
    cmd('Ресурс ФН', `Фискальный накопитель ${reg.fn}: ресурс в норме, замена не требуется`),
    cmd('Служебный чек', 'Служебный (нефискальный) чек напечатан'),
    cmd('Копия последнего чека', 'Копия последнего фискального чека'),
    cmd('Открыть денежный ящик', 'Денежный ящик открыт'),
    cmd('Тех. обнуление', 'Технологическое обнуление выполнено'),
  ]

  // журнал операций ФР — фискальные события смены (продажи/возвраты/касса), как в iikoFront
  const journal = [
    ...closedOrders.map((o) => ({ t: (o.paidAt.split(',')[1] ?? '').trim().slice(0, 5), e: `Продажа · чек №${o.id} · ФД ${o.fiscalDocNo}`, v: formatTenge(o.total) })),
    ...refunds.map((r) => ({ t: (r.at.split(',')[1] ?? '').trim().slice(0, 5), e: `Возврат · ФД ${r.fiscalDocNo}`, v: '− ' + formatTenge(r.amount) })),
    ...cashMovements.map((m) => ({ t: (m.at.split(',')[1] ?? '').trim().slice(0, 5), e: `${m.kind === 'in' ? 'Внесение' : 'Изъятие'} · ${m.type}`, v: (m.kind === 'in' ? '+ ' : '− ') + formatTenge(m.amount) })),
  ].sort((a, b) => a.t.localeCompare(b.t))

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Команды фискальному регистратору" />
      <div className="px-6 pt-4 flex gap-2">
        {fiscalRegistrators.map((f) => (
          <button key={f.id} onClick={() => setFr(f.id)}
            className={`px-4 h-10 rounded-md ${fr === f.id ? 'bg-pos-blue' : 'bg-white/10'}`}>{f.name}</button>
        ))}
      </div>
      {/* строка состояния ФР: смена / непереданные в ОФД / ресурс */}
      <div className="px-6 pt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="text-white/50">ФН: <span className="text-white/80">{reg.fn}</span></span>
        <span className="text-white/50">Смена: <span className={reg.shiftOpen ? 'text-pos-green' : 'text-white/60'}>{reg.shiftOpen ? 'открыта' : 'закрыта'}</span></span>
        <span className="text-white/50">Непереданных в ОФД: <span className={unsentOfd > 0 ? 'text-pos-rose' : 'text-pos-green'}>{unsentOfd}</span></span>
        <span className="text-white/50">Чеков за смену: <span className="text-white/80">{count}</span></span>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {/* X / Z — отдельные кнопки сменных отчётов */}
        <div className="grid grid-cols-2 gap-3 max-w-3xl mb-3">
          <button onClick={() => setReport('x')} disabled={!cashShift || !can('F_XR')} title={can('F_XR') ? '' : 'Нужно право F_XR'}
            className="h-24 rounded-md bg-emerald-600 text-white active:bg-emerald-700 disabled:opacity-40 flex flex-col items-center justify-center">
            <span className="text-lg font-semibold">X-отчёт</span>
            <span className="text-xs opacity-80">без гашения · текущие итоги</span>
          </button>
          <button onClick={() => setReport('z')} disabled={!cashShift || !can('F_ZREP')} title={can('F_ZREP') ? '' : 'Нужно право F_ZREP'}
            className="h-24 rounded-md bg-rose-600 text-white active:bg-rose-700 disabled:opacity-40 flex flex-col items-center justify-center">
            <span className="text-lg font-semibold">Z-отчёт</span>
            <span className="text-xs opacity-80">с гашением · закрытие смены</span>
          </button>
        </div>
        {!cashShift && <div className="text-amber-400 text-xs mb-4">Кассовая смена закрыта — снятие X/Z недоступно.</div>}

        <div className="grid grid-cols-2 gap-3 max-w-3xl">
          {commands.map((c) => (
            <button key={c.label} onClick={() => printToast(c.result)}
              className="h-20 rounded-md bg-white text-gray-800 active:bg-gray-100">{c.label}</button>
          ))}
          <button onClick={() => setShowJournal(true)}
            className="h-20 rounded-md bg-white text-gray-800 active:bg-gray-100 col-span-2">Журнал операций ФР</button>
        </div>
        <div className="text-white/40 text-xs mt-4">KZ Команды идут через драйвер Webkassa. Реальные операции подключаются на бэкенде/.NET.</div>
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>

      {showJournal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowJournal(false)}>
          <div className="bg-white text-gray-800 rounded-lg w-full max-w-md max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b flex items-center">
              <div className="font-semibold">Журнал операций ФР · {reg.name}</div>
              <button onClick={() => setShowJournal(false)} className="ml-auto text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-auto px-5 py-3 text-sm font-mono">
              {journal.length === 0 ? <div className="text-gray-400">— операций за смену нет —</div>
                : journal.map((x, i) => (
                  <div key={i} className="flex justify-between gap-3 py-0.5 border-b border-gray-100">
                    <span><span className="text-gray-400">{x.t || '—'}</span> {x.e}</span>
                    <span className="whitespace-nowrap">{x.v}</span>
                  </div>
                ))}
            </div>
            <div className="px-5 py-3 border-t flex justify-end">
              <button onClick={() => { printToast('Журнал операций ФР распечатан'); setShowJournal(false) }}
                className="h-11 px-6 rounded-md bg-pos-blue text-white">Печать</button>
            </div>
          </div>
        </div>
      )}

      {report && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setReport(null)}>
          <div className="bg-white text-gray-800 rounded-lg w-full max-w-sm font-mono text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 max-h-[80vh] overflow-auto">
              <div className="text-center font-bold">{report === 'x' ? 'X-ОТЧЁТ (без гашения)' : 'Z-ОТЧЁТ (с гашением)'}</div>
              <div className="text-center text-xs text-gray-500 mb-3">
                {reg.name} · ФН {reg.fn}<br />
                Терминал №998 · Кассовая смена №{cashShift?.no ?? '—'}<br />
                KZ ҚҚС 16% · {cashShift?.openedAt ?? ''}
              </div>
              <Row k="Чеков закрыто" v={String(count)} />
              <Row k="Гостей" v={String(guests)} />
              <Row k="Выручка" v={formatTenge(revenue)} b />
              <Row k="в т.ч. ҚҚС 16%" v={formatTenge(vat)} />
              <Row k="Средний чек" v={formatTenge(avg)} />
              <div className="border-t border-dashed my-2" /><div className="text-gray-500">По типам оплаты:</div>
              {Object.keys(byType).length === 0 ? <div className="text-gray-400">— нет —</div>
                : Object.entries(byType).map(([k, v]) => <Row key={k} k={`${k} (${v.count})`} v={formatTenge(v.sum)} />)}
              <div className="border-t border-dashed my-2" /><div className="text-gray-500">Касса:</div>
              <Row k="Разменный фонд" v={formatTenge(fund)} />
              <Row k="Внесения" v={formatTenge(otherCashIn)} />
              <Row k="Продажи наличными" v={formatTenge(cashPaid)} />
              <Row k="Изъятия" v={'− ' + formatTenge(cashOut)} />
              <Row k="Возвраты наличными" v={'− ' + formatTenge(cashRefunds)} />
              <Row k="Наличных в ящике" v={formatTenge(cashInDrawer)} b />
              <div className="text-center text-xs text-gray-400 mt-3 border-t pt-2">
                {report === 'x' ? 'Промежуточный отчёт — смена НЕ закрывается.' : 'Сменный отчёт с гашением — смена будет закрыта.'}
              </div>
            </div>
            <div className="px-5 py-3 border-t flex gap-3 justify-end font-sans">
              <button onClick={() => setReport(null)} className="h-11 px-5 rounded-md border border-gray-300 hover:bg-gray-100">Закрыть</button>
              {report === 'x' ? (
                <button onClick={() => { printToast('X-отчёт снят (без гашения)'); setReport(null) }}
                  className="h-11 px-6 rounded-md bg-emerald-600 text-white">Печать X-отчёта</button>
              ) : (
                <button onClick={() => { setReport(null); navigate('/shift/close') }}
                  className="h-11 px-6 rounded-md bg-rose-600 text-white">Закрыть смену (Z)</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const Row = ({ k, v, b }: { k: string; v: string; b?: boolean }) => (
  <div className={`flex justify-between py-0.5 gap-3 ${b ? 'font-bold' : ''}`}><span>{k}</span><span className="whitespace-nowrap">{v}</span></div>
)
