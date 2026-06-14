// Расписание смен (раздел 06): плановые часы из назначенных смен.
// Назначение = дата(ISO) → id типа смены; тип смены задаёт время from–to.

export interface ShiftTypeLite { id: string; from: string; to: string }

const toMin = (t: string): number => { const m = /^(\d{1,2}):(\d{2})/.exec(t.trim()); return m ? +m[1] * 60 + +m[2] : 0 }

// Длительность смены в часах (через полночь не считаем — мок).
export function shiftHours(st: { from: string; to: string }): number {
  return +(Math.max(0, toMin(st.to) - toMin(st.from)) / 60).toFixed(1)
}

// Плановые часы сотрудника = сумма длительностей назначенных смен.
export function plannedHours(assignments: Record<string, string>, shiftTypes: ShiftTypeLite[]): number {
  let h = 0
  for (const stId of Object.values(assignments)) {
    const st = shiftTypes.find((s) => s.id === stId)
    if (st) h += shiftHours(st)
  }
  return +h.toFixed(1)
}
