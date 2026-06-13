// KZ Форматирование в тенге ₸ и расчёт НДС (ҚҚС) 16%.

export const formatTenge = (n: number): string =>
  new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ₸'

// НДС включён в цену (как в рознице): выделяем сумму налога из суммы с НДС.
export const vatAmount = (gross: number, rate: number): number =>
  rate === 0 ? 0 : +(gross - gross / (1 + rate / 100)).toFixed(2)

// Мультиставка ҚҚС: разбивка по ставкам из позиций (каждая со своей ставкой 16%/0%).
// Возвращает по каждой встреченной ставке: оборот (с НДС), сумму НДС, оборот без НДС.
export interface VatRow { rate: number; gross: number; vat: number; net: number }
export function vatBreakdown(items: { gross: number; rate: number }[]): VatRow[] {
  const byRate: Record<number, number> = {}
  for (const it of items) byRate[it.rate] = (byRate[it.rate] ?? 0) + it.gross
  return Object.keys(byRate)
    .map(Number)
    .sort((a, b) => b - a)
    .map((rate) => {
      const gross = +byRate[rate].toFixed(2)
      const vat = vatAmount(gross, rate)
      return { rate, gross, vat, net: +(gross - vat).toFixed(2) }
    })
}
