import { describe, it, expect } from 'vitest'
import { planFact } from './planfact'

describe('planFact — план vs факт', () => {
  it('средний чек = выручка/чеки; отклонение и % выполнения', () => {
    const rows = planFact({ revenue: 100000, checks: 200 }, { revenue: 80000, checks: 160 })
    const by = (m: string) => rows.find((r) => r.metric === m)!
    expect(by('Выручка')).toMatchObject({ plan: 100000, fact: 80000, deviation: -20000, pct: 80 })
    expect(by('Число чеков')).toMatchObject({ plan: 200, fact: 160, deviation: -40, pct: 80 })
    // средний чек: план 500, факт 500 → выполнено 100%
    expect(by('Средний чек')).toMatchObject({ plan: 500, fact: 500, deviation: 0, pct: 100 })
  })
  it('нулевой план → pct 0 (без деления на ноль)', () => {
    const rows = planFact({ revenue: 0, checks: 0 }, { revenue: 5000, checks: 10 })
    expect(rows.every((r) => r.pct === 0)).toBe(true)
    expect(rows.find((r) => r.metric === 'Средний чек')!.fact).toBe(500)
  })
})
