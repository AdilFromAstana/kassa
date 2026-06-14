// План-факт на месяц (iiko, topic-405): план по выручке / числу чеков / среднему чеку,
// факт — из закрытых чеков. Связаны формулой: Средний чек = Выручка / Число чеков.

export interface PlanFactInput { revenue: number; checks: number }
export interface PlanFactRow { metric: string; plan: number; fact: number; deviation: number; pct: number; money: boolean }

const avg = (rev: number, checks: number) => (checks ? +(rev / checks).toFixed(2) : 0)

export function planFact(plan: PlanFactInput, fact: PlanFactInput): PlanFactRow[] {
  const row = (metric: string, p: number, f: number, money: boolean): PlanFactRow =>
    ({ metric, plan: p, fact: f, deviation: +(f - p).toFixed(2), pct: p ? Math.round((f / p) * 100) : 0, money })
  return [
    row('Выручка', plan.revenue, fact.revenue, true),
    row('Число чеков', plan.checks, fact.checks, false),
    row('Средний чек', avg(plan.revenue, plan.checks), avg(fact.revenue, fact.checks), true),
  ]
}
