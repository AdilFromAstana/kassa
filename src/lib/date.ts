// Хелперы дат для банкетов/явок (тач-касса). Даты храним как ISO 'YYYY-MM-DD'.
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

export const toISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const fromISO = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export const todayISO = (): string => toISO(new Date())

export const addDaysISO = (iso: string, n: number): string => {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

// «10 июня 2026 г.»
export const formatRu = (iso: string): string => {
  const d = fromISO(iso)
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()} г.`
}

// Относительная метка: Сегодня / Завтра / Вчера / dd.mm.yyyy
export const relLabel = (iso: string): string => {
  const t = todayISO()
  if (iso === t) return 'Сегодня'
  if (iso === addDaysISO(t, 1)) return 'Завтра'
  if (iso === addDaysISO(t, -1)) return 'Вчера'
  const d = fromISO(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

// Минут прошло с «HH:MM» до текущего момента (для индикации занятости стола).
export const minutesSince = (hhmm: string): number => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim())
  if (!m) return 0
  const now = new Date()
  const open = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +m[1], +m[2])
  const diff = Math.floor((now.getTime() - open.getTime()) / 60000)
  return diff < 0 ? 0 : diff
}
