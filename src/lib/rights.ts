// Права доступа iikoFront (коды F_*). В реальной iiko назначаются роли в iikoOffice;
// здесь — мок-модель: какие права даёт каждая должность (positions у Staff).
// Расширяется по мере закрытия аудита (F_STRN — возврат, F_OCS — кассовая смена и т.д.).

// Человекочитаемые названия прав (для подсказок в UI).
// Коды и названия — по iiko_spec/PERMISSIONS.md (реверс реальной iiko).
export const RIGHTS: Record<string, string> = {
  F_EM: 'Редактировать стоп-лист и быстрое меню',
  F_STRN: 'Производить возврат оплаты (со списанием на склад)',
  F_SWWOFF: 'Производить возврат без списания',
  F_OCS: 'Открывать кассовую смену',
  F_CS: 'Закрывать кассовую смену',
  F_CASH: 'Внесение / изъятие денег',
  F_DR: 'Открывать денежный ящик',
  F_XR: 'Печать X-отчёта',
  F_ZREP: 'Полный отчёт (Z)',
  F_ID: 'Ручная скидка / надбавка',
  F_CCB: 'Отмена пречека',
  F_CVS: 'Редактировать явки',
  F_CHPAY: 'Изменять тип оплаты закрытого заказа',
  F_VRPT: 'Отчёты во Front',
  F_CHO: 'Открывать заказы',
  F_CPBA: 'Печать пречека',
  F_VRS: 'Просмотр резервов / банкетов',
  F_ERS: 'Редактирование резервов / банкетов',
  F_AOT: 'Заказы других официантов',
}

// Должность → набор прав ПО УМОЛЧАНИЮ (мок-модель ролей; в офисе можно переопределить).
// Официант/бармен — без кассовых операций, скидок, возвратов и явок; кассир — кассовые; менеджер — всё.
export const POSITION_RIGHTS: Record<string, string[]> = {
  Официант: ['F_CHO', 'F_CPBA', 'F_VRS'],
  Бармен: ['F_CHO', 'F_CPBA', 'F_VRS'],
  Кассир: ['F_OCS', 'F_CS', 'F_CASH', 'F_DR', 'F_XR', 'F_CHO', 'F_CPBA', 'F_VRPT', 'F_CHPAY'],
  Менеджер: [
    'F_EM', 'F_STRN', 'F_SWWOFF', 'F_ID', 'F_CCB', 'F_CVS', 'F_CHPAY', 'F_VRPT', 'F_ZREP', 'F_ERS', 'F_VRS', 'F_AOT',
    'F_OCS', 'F_CS', 'F_CASH', 'F_DR', 'F_XR', 'F_CHO', 'F_CPBA',
  ],
}

// Должности в порядке для UI матрицы прав в офисе.
export const POSITIONS = Object.keys(POSITION_RIGHTS)

// Проверка по произвольной карте роль→права (карта приходит из стора, чтобы офис мог менять).
export const hasRightIn = (roleRights: Record<string, string[]>, positions: string[] | undefined, code: string): boolean =>
  (positions ?? []).some((p) => (roleRights[p] ?? []).includes(code))

// Дефолтная проверка (по встроенной карте) — фолбэк.
export const hasRight = (positions: string[] | undefined, code: string): boolean =>
  hasRightIn(POSITION_RIGHTS, positions, code)
