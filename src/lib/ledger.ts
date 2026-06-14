import type { ClosedOrder, Invoice, CashMovement, Ingredient, JournalEntry } from '../types'
import { vatAmount } from './money'
import { dishCost } from '../mock/warehouse'

// ─────────────────────────────────────────────────────────────────────────────
// Авто-проводки двойной записи (план счетов РК) из операций кассы/закупок/ЗП.
// Выделено из OfficeLedger, чтобы переиспользовать для «OLAP по проводкам» и держать
// единый источник правил. Каждая проводка сбалансирована (Дт=Кт на amount), поэтому
// Σ дебетовых сумм == Σ кредитовых == Σ amount по построению.
// ─────────────────────────────────────────────────────────────────────────────

export function buildAutoPostings(args: {
  closedOrders: ClosedOrder[]
  invoices: Invoice[]
  cashMovements: CashMovement[]
  ingredients: Ingredient[]
}): JournalEntry[] {
  const { closedOrders, invoices, cashMovements, ingredients } = args
  const auto: JournalEntry[] = []
  let seq = 0
  const e = (date: string, debit: string, credit: string, amount: number, desc: string) => {
    if (amount > 0.005) auto.push({ id: 'a' + (++seq), date, debit, credit, amount: +amount.toFixed(2), desc, source: 'auto' })
  }

  // продажи: деньги → выручка, выделение ҚҚС, себестоимость
  for (const o of closedOrders) {
    const vat = vatAmount(o.total, 16)
    const cash = o.payments.filter((p) => p.paymentTypeId === 'p-cash').reduce((s, p) => s + p.amount, 0)
    const bank = +(o.total - cash).toFixed(2)
    e(o.paidAt, '1010', '6010', cash, `Продажа нал. чек №${o.id}`)
    e(o.paidAt, '1030', '6010', bank, `Продажа безнал/прочее чек №${o.id}`)
    e(o.paidAt, '6010', '3130', vat, `ҚҚС 16% с продажи №${o.id}`)
    const cost = o.lines.reduce((s, l) => s + dishCost(l.dishId, ingredients) * l.qty, 0)
    e(o.paidAt, '7010', '1330', cost, `Себестоимость продажи №${o.id}`)
  }
  // закупки: товар + входящий ҚҚС / поставщику
  for (const inv of invoices.filter((i) => i.kind !== 'out')) {
    e(inv.date, '1330', '3310', +(inv.total - inv.vat).toFixed(2), `Приход товара ${inv.no}`)
    e(inv.date, '1420', '3310', inv.vat, `Входящий ҚҚС ${inv.no}`)
  }
  // касса: зарплата (начисление+выплата), инкассация/изъятие, внесения
  for (const m of cashMovements) {
    if (/зарплат|аванс/i.test(m.type)) {
      e(m.at, '7210', '3350', m.amount, `Начисление ЗП · ${m.comment}`)
      e(m.at, '3350', '1010', m.amount, `Выплата ЗП · ${m.comment}`)
    } else if (m.kind === 'out') {
      e(m.at, '1030', '1010', m.amount, `${m.type} (касса → банк)`)
    } else {
      e(m.at, '1010', '1030', m.amount, `${m.type} (банк → касса)`)
    }
  }
  return auto
}
