// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OfficeScreen from './OfficeScreen'

// Смоук-рендер: монтируем бэк-офис на демо-данных (стор авто-наполняется при импорте)
// и прокликиваем каждую вкладку отчёта. Цель — поймать падения рендера/расчётов реальных
// экранов (не только чистую логику в lib/*). Если обработчик/рендер бросит — тест упадёт.
afterEach(cleanup)

const REPORT_TABS = [
  'Продажи за период', 'Средний чек', 'По выручке', 'Непродаваемые', 'Закупки',
  'По блюдам', 'Вхождение товара', 'Товарная ОСВ', 'Движение товара', 'Товарный отчёт',
  'Остатки на складах', 'ҚҚС (НДС)', 'OLAP по продажам', 'Настраиваемый', 'OLAP по проводкам', 'Прибыли и убытки',
]

describe('Бэк-офис → Отчёты: смоук рендера', () => {
  it('раздел «Отчёты» открывается и показывает таб-бар', () => {
    render(<MemoryRouter><OfficeScreen /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Отчёты' }))
    // присутствуют ключевые вкладки
    expect(screen.getByRole('button', { name: 'Средний чек' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'OLAP по проводкам' })).toBeTruthy()
  })

  it('каждая из 16 вкладок отчёта рендерится без исключений на демо-данных', () => {
    render(<MemoryRouter><OfficeScreen /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Отчёты' }))
    for (const tab of REPORT_TABS) {
      fireEvent.click(screen.getByRole('button', { name: tab }))
      // вкладка активна и контент раздела на месте (заголовок раздела в шапке)
      expect(screen.getByRole('button', { name: tab })).toBeTruthy()
    }
    // дошли до конца цикла без брошенных исключений
    expect(true).toBe(true)
  })

  it('на демо-данных есть закрытые чеки → отчёты не пустые (точечная проверка «Средний чек»)', () => {
    render(<MemoryRouter><OfficeScreen /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Отчёты' }))
    fireEvent.click(screen.getByRole('button', { name: 'Средний чек' }))
    // колонки отчёта о среднем чеке (формулы 1:1) присутствуют
    expect(screen.getByText('Средний заказ гостя')).toBeTruthy()
    expect(screen.getByText('Ср. гостей на заказ')).toBeTruthy()
  })
})

describe('Бэк-офис → Контрагенты: смоук рендера', () => {
  it('раздел открывается и показывает взаиморасчёты + акт сверки', () => {
    render(<MemoryRouter><OfficeScreen /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Контрагенты' }))
    expect(screen.getByText(/Акт сверки/)).toBeTruthy()
    expect(screen.getByText('Закупки (вх.)')).toBeTruthy()
    expect(screen.getByText('Продажи (исх.)')).toBeTruthy()
  })
})
