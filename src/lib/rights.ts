// Права доступа iiko (полный справочник, по iiko_spec/PERMISSIONS.md).
//  F_* — касса iikoFront · B_* — офис iikoChain/iikoOffice · D_* — доставка iikoDelivery.
// Принцип iiko: «что не разрешено — запрещено». Видимость/доступность кнопки = (есть право) И (состояние смены/ФР).

export interface RightDef { code: string; name: string }
export interface RightGroup { title: string; scope: 'front' | 'office' | 'delivery'; rights: RightDef[] }

// Сгруппированный каталог прав (как разделы матрицы в iikoOffice «Сотрудники → Права доступа»).
export const RIGHT_GROUPS: RightGroup[] = [
  { title: 'Касса: смена и деньги', scope: 'front', rights: [
    { code: 'F_OCS', name: 'Открывать кассовую смену' },
    { code: 'F_CS', name: 'Закрывать кассовую смену' },
    { code: 'F_CSE', name: 'Аварийно закрывать смену (поломка ФР)' },
    { code: 'F_CASH', name: 'Внесение / изъятие денег' },
    { code: 'F_APIO', name: 'Авторизовывать внесения/изъятия' },
    { code: 'F_DR', name: 'Открывать денежный ящик' },
    { code: 'F_XR', name: 'Печать X-отчёта' },
    { code: 'F_ZREP', name: 'Полный отчёт (Z)' },
    { code: 'F_CST', name: 'Выключать терминал' },
    { code: 'F_CA', name: 'Закрывать приложение' },
    { code: 'F_RUOFF', name: 'Запускать iikoOffice из Front' },
  ] },
  { title: 'Касса: заказы и столы', scope: 'front', rights: [
    { code: 'F_CHO', name: 'Открывать заказы' },
    { code: 'F_AOT', name: 'Заказы других официантов' },
    { code: 'F_OMO', name: 'Несколько заказов на стол' },
    { code: 'F_CMP', name: 'Перенос столов с отпечатанными' },
    { code: 'F_COW', name: 'Перенос заказа другому официанту' },
    { code: 'F_CGC', name: 'Менять число гостей' },
    { code: 'F_MPR', name: 'Объединять столы/заказы' },
    { code: 'F_DNPI', name: 'Удалять неотпечатанные позиции' },
    { code: 'F_DP', name: 'Удалять отпечатанные до пречека' },
    { code: 'F_PA', name: 'Повторная печать блюд' },
    { code: 'F_IPS', name: 'Продавать вне расписания прейскуранта' },
    { code: 'F_EFA', name: 'Дробное количество' },
  ] },
  { title: 'Касса: оплата и чеки', scope: 'front', rights: [
    { code: 'F_CPBA', name: 'Печать пречека' },
    { code: 'F_CCB', name: 'Отмена пречека' },
    { code: 'F_PAW', name: 'Принимать предоплату' },
    { code: 'F_REP', name: 'Удаление предоплаты' },
    { code: 'F_STRN', name: 'Возврат оплаты (со списанием на склад)' },
    { code: 'F_SWWOFF', name: 'Возврат без списания' },
    { code: 'F_CHPAY', name: 'Изменять тип оплаты закрытого заказа' },
    { code: 'F_CRCT', name: 'Чек коррекции (фискальная коррекция)' },
    { code: 'F_COTH', name: 'Оплата «за счёт заведения»' },
    { code: 'F_COC', name: 'Оплата в кредит' },
    { code: 'F_ECL', name: 'Игнорировать лимит чека' },
  ] },
  { title: 'Касса: скидки и бонусы', scope: 'front', rights: [
    { code: 'F_ID', name: 'Ручная скидка / надбавка' },
    { code: 'F_IDGC', name: 'Скидка по карте гостя' },
    { code: 'F_IDCN', name: 'Скидка по номеру карты' },
    { code: 'F_APA', name: 'Подтверждать бонусы (iikoCard)' },
  ] },
  { title: 'Касса: персонал и сервис', scope: 'front', rights: [
    { code: 'F_CVS', name: 'Редактировать явки' },
    { code: 'F_KIS', name: 'Закрывать чужие смены' },
    { code: 'F_VOS', name: 'Видеть открытые смены' },
    { code: 'F_POB', name: 'Штрафы / премии' },
    { code: 'F_SC', name: 'Подменные карты' },
    { code: 'F_OPIN', name: 'Открытие смены по PIN' },
    { code: 'F_VPSD', name: 'Видеть свою зарплату' },
    { code: 'F_VRS', name: 'Просмотр резервов / банкетов' },
    { code: 'F_ERS', name: 'Редактирование резервов / банкетов' },
    { code: 'F_VRPT', name: 'Отчёты во Front' },
    { code: 'F_REREP', name: 'Реестр счетов' },
    { code: 'F_EM', name: 'Редактировать стоп-лист и быстрое меню' },
  ] },
  { title: 'Офис: розничные продажи', scope: 'office', rights: [
    { code: 'B_SALE', name: 'Розничные продажи (базовое)' },
    { code: 'B_ACS', name: 'Принимать кассовые смены' },
    { code: 'B_ACO', name: 'Просматривать кассовые смены' },
    { code: 'B_APT', name: 'Типы оплат' },
  ] },
  { title: 'Офис: товары и склады', scope: 'office', rights: [
    { code: 'B_STO', name: 'Товары и склады (базовое)' },
    { code: 'B_VN', name: 'Просмотр номенклатуры' },
    { code: 'B_EN', name: 'Редактирование номенклатуры' },
    { code: 'B_EAC', name: 'Технологические карты' },
    { code: 'B_INVV', name: 'Накладные: просмотр' },
    { code: 'B_INVC', name: 'Накладные: создание/правка' },
    { code: 'B_INVR', name: 'Накладные: проведение' },
    { code: 'B_VI', name: 'Инвентаризация: просмотр' },
    { code: 'B_CI', name: 'Инвентаризация: создание' },
    { code: 'B_PI', name: 'Инвентаризация: проведение' },
    { code: 'B_WOFFC', name: 'Акты списания: создание' },
    { code: 'B_PRODC', name: 'Акты приготовления: создание' },
  ] },
  { title: 'Офис: контрагенты', scope: 'office', rights: [
    { code: 'B_CTR', name: 'Контрагенты (базовое)' },
    { code: 'B_GUEST', name: 'Справочник гостей/клиентов' },
    { code: 'B_SUPP', name: 'Поставщики' },
    { code: 'B_CHL', name: 'Прайс-листы' },
  ] },
  { title: 'Офис: финансы', scope: 'office', rights: [
    { code: 'B_FIN', name: 'Финансы (базовое)' },
    { code: 'B_VCOA', name: 'План счетов: просмотр' },
    { code: 'B_ECOA', name: 'План счетов: правка' },
    { code: 'B_ECB', name: 'Ручные проводки' },
    { code: 'B_ECFA', name: 'Статьи ДДС' },
    { code: 'B_BKI', name: 'Банковская выписка' },
    { code: 'B_VBALR', name: 'Баланс' },
    { code: 'B_VCFR', name: 'ДДС (отчёт)' },
  ] },
  { title: 'Офис: сотрудники и зарплата', scope: 'office', rights: [
    { code: 'B_PER', name: 'Сотрудники (базовое)' },
    { code: 'B_VE', name: 'Карточки: просмотр' },
    { code: 'B_EE', name: 'Карточки: правка' },
    { code: 'B_VP', name: 'Права: просмотр' },
    { code: 'B_EP', name: 'Права: правка' },
    { code: 'B_CVEJ', name: 'Расписание / явки' },
    { code: 'B_EPP', name: 'Ведомости' },
    { code: 'B_PAY', name: 'Начисления / выплаты' },
  ] },
  { title: 'Офис: прейскурант и отчёты', scope: 'office', rights: [
    { code: 'B_MENOR', name: 'Прейскурант: просмотр' },
    { code: 'B_ROMENOR', name: 'Прейскурант: правка' },
    { code: 'B_PMENOR', name: 'Проводить приказы цен' },
    { code: 'B_RPT', name: 'Отчёты (базовое)' },
    { code: 'B_VSR', name: 'Складские отчёты' },
    { code: 'B_CASR', name: 'Отчёты по продажам' },
    { code: 'B_VREPORT', name: 'Настраиваемые отчёты: просмотр' },
    { code: 'B_EREPORT', name: 'Настраиваемые отчёты: правка' },
  ] },
  { title: 'Офис: дисконт, период, обмен, админ', scope: 'office', rights: [
    { code: 'B_CUDS', name: 'Дисконтная система' },
    { code: 'B_CCLP', name: 'Закрытие периода' },
    { code: 'B_WCP', name: 'Работа в закрытом периоде' },
    { code: 'B_CEDT', name: 'Менять время документа' },
    { code: 'B_EBDD', name: 'Документы задним числом' },
    { code: 'B_EXC', name: 'Обмен данными (1С и т.п.)' },
    { code: 'B_ADM', name: 'Администрирование' },
    { code: 'B_DB', name: 'Обслуживание БД' },
    { code: 'B_EA', name: 'Новости / избранное' },
    { code: 'B_EC', name: 'Конфигурация ТП' },
    { code: 'B_VCPS', name: 'Даты блокировки (корпорация)' },
    { code: 'B_SYNC_MON', name: 'Монитор синхронизации' },
  ] },
  { title: 'Доставка (iikoDelivery)', scope: 'delivery', rights: [
    { code: 'D_ED', name: 'Редактирование доставки' },
    { code: 'D_MD', name: 'Управление доставкой' },
    { code: 'D_CD', name: 'Закрытие доставки' },
    { code: 'D_CAD', name: 'Отмена доставки' },
    { code: 'D_CND', name: 'Подтверждать доставки' },
    { code: 'D_AC', name: 'Назначать курьеров' },
    { code: 'D_ACMS', name: 'Назначить курьером себя' },
    { code: 'D_DCO', name: 'Быть курьером' },
    { code: 'D_BDR', name: 'Обходить ограничения графика/картографии' },
    { code: 'D_AHR', name: 'Добавлять в «Высокий риск»' },
    { code: 'D_SFN', name: 'Видеть полный телефон клиента' },
    { code: 'D_ACL', name: 'Просматривать расположение курьеров' },
  ] },
]

// Человекочитаемые названия прав (code → name) — плоский справочник для подсказок.
export const RIGHTS: Record<string, string> = Object.fromEntries(
  RIGHT_GROUPS.flatMap((g) => g.rights.map((r) => [r.code, r.name])),
)
export const ALL_RIGHT_CODES = Object.keys(RIGHTS)
const codesOf = (scope: RightGroup['scope']) => RIGHT_GROUPS.filter((g) => g.scope === scope).flatMap((g) => g.rights.map((r) => r.code))

// Должность → набор прав ПО УМОЛЧАНИЮ (правится в офисе). «Что не разрешено — запрещено».
export const POSITION_RIGHTS: Record<string, string[]> = {
  Официант: ['F_CHO', 'F_CPBA', 'F_VRS', 'F_EFA', 'F_CGC', 'F_PA', 'F_OPIN', 'F_VPSD'],
  Бармен: ['F_CHO', 'F_CPBA', 'F_VRS', 'F_EFA', 'F_OPIN', 'F_VPSD'],
  Повар: ['F_VOS', 'F_OPIN'],
  Кассир: ['F_OCS', 'F_CS', 'F_CASH', 'F_APIO', 'F_DR', 'F_XR', 'F_CHO', 'F_CPBA', 'F_VRPT', 'F_CHPAY', 'F_CRCT', 'F_PAW', 'F_REP', 'F_OPIN', 'F_VPSD', 'F_REREP'],
  Менеджер: [
    ...codesOf('front'),
    'D_ED', 'D_MD', 'D_CD', 'D_CAD', 'D_CND', 'D_AC', 'D_AHR', 'D_SFN', 'D_ACL', 'D_BDR',
  ],
  Управляющий: [
    'B_SALE', 'B_ACS', 'B_ACO', 'B_APT', 'B_STO', 'B_VN', 'B_EN', 'B_EAC', 'B_INVV', 'B_INVC', 'B_INVR', 'B_VI', 'B_CI', 'B_PI',
    'B_CTR', 'B_GUEST', 'B_SUPP', 'B_CHL', 'B_MENOR', 'B_ROMENOR', 'B_PMENOR', 'B_RPT', 'B_VSR', 'B_CASR', 'B_VREPORT', 'B_CUDS',
    'B_PER', 'B_VE', 'B_PAY', 'B_EC', 'F_VRPT', 'D_MD', 'D_AC', 'D_ACL',
  ],
  Бухгалтер: [
    'B_FIN', 'B_VCOA', 'B_ECOA', 'B_ECB', 'B_ECFA', 'B_BKI', 'B_VBALR', 'B_VCFR', 'B_RPT', 'B_VSR', 'B_CASR',
    'B_STO', 'B_VN', 'B_INVV', 'B_CTR', 'B_SUPP', 'B_PER', 'B_VE', 'B_EPP', 'B_PAY', 'B_EXC', 'B_CCLP', 'B_CEDT', 'B_VREPORT',
  ],
  Администратор: [...ALL_RIGHT_CODES],
}

// Должности/роли в порядке для матрицы прав в офисе.
export const POSITIONS = Object.keys(POSITION_RIGHTS)

// Проверка по произвольной карте роль→права (карта приходит из стора, чтобы офис мог менять).
export const hasRightIn = (roleRights: Record<string, string[]>, positions: string[] | undefined, code: string): boolean =>
  (positions ?? []).some((p) => (roleRights[p] ?? []).includes(code))

// Дефолтная проверка (по встроенной карте) — фолбэк.
export const hasRight = (positions: string[] | undefined, code: string): boolean =>
  hasRightIn(POSITION_RIGHTS, positions, code)
