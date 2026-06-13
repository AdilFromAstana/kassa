// Права доступа iikoFront (коды F_*). В реальной iiko назначаются роли в iikoOffice;
// здесь — мок-модель: какие права даёт каждая должность (positions у Staff).
// Расширяется по мере закрытия аудита (F_STRN — возврат, F_OCS — кассовая смена и т.д.).

// Человекочитаемые названия прав (для подсказок в UI).
export const RIGHTS: Record<string, string> = {
  F_EM: 'Редактировать стоп-лист и быстрое меню',
  F_STRN: 'Производить возврат оплаты (со списанием на склад)',
  F_SWWOFF: 'Производить возврат без списания',
}

// Должность → набор прав. Стоп-лист и возвраты — только у Менеджера (не у официанта/бармена/кассира).
const POSITION_RIGHTS: Record<string, string[]> = {
  Менеджер: ['F_EM', 'F_STRN', 'F_SWWOFF'],
}

export const hasRight = (positions: string[] | undefined, code: string): boolean =>
  (positions ?? []).some((p) => (POSITION_RIGHTS[p] ?? []).includes(code))
