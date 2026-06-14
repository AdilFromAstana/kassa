// iikoCard — расчёт по конструктору акций (модуль 15). Акции «условие → действие» из офиса
// определяют начисление бонусов, лимит оплаты бонусами и приветственный бонус.
// Порядок применения программ: скидки → оплата бонусами → списание со счёта (депозит). См. iiko_spec/15_iikocard.md.
import type { PromoAction } from '../types'

// Приветственный бонус при выпуске карты = сумма активных действий «welcome».
export const welcomeBonusOf = (actions: PromoAction[]): number =>
  actions.filter((a) => a.active && a.type === 'welcome').reduce((s, a) => s + (a.amount ?? 0), 0)

// Лимит оплаты бонусами, % чека = максимум среди активных действий «paymentLimit» (0 — оплата бонусами выключена).
export const redeemLimitPctOf = (actions: PromoAction[]): number =>
  actions.filter((a) => a.active && a.type === 'paymentLimit').reduce((m, a) => Math.max(m, a.percent ?? 0), 0)

// Начисление бонусов за заказ по активным действиям начисления (с учётом условия minSum и маски категории).
// total — итог заказа; groupSum(groupId) — сумма строк заказа по категории (для маски блюд).
export function accrualFor(
  actions: PromoAction[],
  total: number,
  groupSum: (groupId: string) => number,
): number {
  let bonus = 0
  for (const a of actions) {
    if (!a.active) continue
    if (a.minSum && total < a.minSum) continue
    if (a.type === 'accruePercent') {
      const base = a.groupId ? groupSum(a.groupId) : total
      bonus += base * (a.percent ?? 0) / 100
    } else if (a.type === 'accrueFixed') {
      bonus += a.amount ?? 0
    }
  }
  return Math.round(bonus)
}
