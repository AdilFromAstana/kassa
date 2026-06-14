// Экспорт отчётов в Excel (как кнопка «Excel…» в iikoOffice). Без бэка — CSV с BOM и разделителем «;»,
// который Excel (ru-локаль) открывает корректно с раскладкой по столбцам. Числа — с запятой.
const esc = (v: string | number): string => {
  const s = String(v ?? '')
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

// Экспорт таблицы (первый ряд — заголовки) в .csv для Excel.
export function downloadExcel(filename: string, rows: (string | number)[][]): void {
  const csv = rows.map((r) => r.map(esc).join(';')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }) // BOM → кириллица в Excel
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

// число для Excel: запятая как десятичный разделитель (ru-локаль), 2 знака.
export const xlsNum = (n: number, digits = 2): string => n.toFixed(digits).replace('.', ',')
