// KZ Форматирование в тенге ₸ и расчёт НДС (ҚҚС) 16%.

export const formatTenge = (n: number): string =>
  new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ₸'

// НДС включён в цену (как в рознице): выделяем сумму налога из суммы с НДС.
export const vatAmount = (gross: number, rate: number): number =>
  rate === 0 ? 0 : +(gross - gross / (1 + rate / 100)).toFixed(2)
