import type { MenuGroup, Dish, ModifierGroup } from '../types'

// KZ Меню (мок) — тенге ₸, НДС 16%. Структура как быстрое меню iikoFront (3 страницы).

export const menuGroups: MenuGroup[] = [
  { id: 'g-hot', name: 'Горячее', page: 1 },
  { id: 'g-nat', name: 'Национальное', page: 1 },
  { id: 'g-drink', name: 'Напитки', page: 1 },
  { id: 'g-coffee', name: 'Кофейня', page: 1 },
  { id: 'g-bar', name: 'Бар', page: 2 },
  { id: 'g-dessert', name: 'Десерты', page: 2 },
  { id: 'g-goods', name: 'Товары', page: 2 },
  { id: 'g-service', name: 'Услуги', page: 3 },
]

export const modifierGroups: ModifierGroup[] = [
  {
    id: 'm-garnir',
    name: 'Гарнир',
    min: 1,
    max: 1,
    options: [
      { id: 'mo-rice', name: 'Рис', price: 0 },
      { id: 'mo-buckwheat', name: 'Гречка', price: 0 },
      { id: 'mo-potato', name: 'Картофель фри', price: 300 },
    ],
  },
  {
    id: 'm-coffee-milk',
    name: 'Молоко',
    min: 0,
    max: 1,
    options: [
      { id: 'mo-regular', name: 'Обычное', price: 0 },
      { id: 'mo-lactfree', name: 'Безлактозное', price: 200 },
      { id: 'mo-coconut', name: 'Кокосовое', price: 250 },
    ],
  },
  {
    id: 'm-syrup',
    name: 'Сироп',
    min: 0,
    max: 3,
    options: [
      { id: 'mo-caramel', name: 'Карамель', price: 150 },
      { id: 'mo-vanilla', name: 'Ваниль', price: 150 },
      { id: 'mo-nut', name: 'Орех', price: 150 },
    ],
  },
]

export const dishes: Dish[] = [
  // Горячее
  { id: 'd-rulka', code: '1001', name: 'Баранья рулька', price: 16000, vat: 16, groupId: 'g-hot', modifierGroupIds: ['m-garnir'] },
  { id: 'd-steak', code: '1002', name: 'Стейк рибай', price: 18000, vat: 16, groupId: 'g-hot', modifierGroupIds: ['m-garnir'] },
  { id: 'd-cutlet', code: '1003', name: 'Котлета по-киевски', price: 7000, vat: 16, groupId: 'g-hot', modifierGroupIds: ['m-garnir'] },
  // Национальное
  { id: 'd-besh', code: '2001', name: 'Бесбармак астау', price: 70000, vat: 16, groupId: 'g-nat' },
  { id: 'd-plov', code: '2002', name: 'Казан-плов', price: 20000, vat: 16, groupId: 'g-nat' },
  { id: 'd-manty', code: '2003', name: 'Манты (5 шт)', price: 4500, vat: 16, groupId: 'g-nat' },
  { id: 'd-lagman', code: '2004', name: 'Лагман', price: 5000, vat: 16, groupId: 'g-nat' },
  // Напитки
  { id: 'd-cola', code: '3001', name: 'Кола 0.5', price: 800, vat: 16, groupId: 'g-drink' },
  { id: 'd-water', code: '3002', name: 'Вода 0.5', price: 500, vat: 16, groupId: 'g-drink' },
  { id: 'd-juice', code: '3003', name: 'Сок свежевыжатый', price: 2200, vat: 16, groupId: 'g-drink' },
  // Кофейня
  { id: 'd-cappu', code: '4001', name: 'Капучино', price: 1495, vat: 16, groupId: 'g-coffee', color: '#cdb27a', modifierGroupIds: ['m-coffee-milk', 'm-syrup'] },
  { id: 'd-latte', code: '4002', name: 'Латте', price: 1600, vat: 16, groupId: 'g-coffee', color: '#cdb27a', modifierGroupIds: ['m-coffee-milk', 'm-syrup'] },
  { id: 'd-esp', code: '4003', name: 'Эспрессо', price: 900, vat: 16, groupId: 'g-coffee', color: '#cdb27a' },
  // Бар
  { id: 'd-beer', code: '5001', name: 'Пиво разливное 0.5', price: 1800, vat: 16, groupId: 'g-bar' },
  { id: 'd-wine', code: '5002', name: 'Вино бокал', price: 2500, vat: 16, groupId: 'g-bar' },
  // Десерты
  { id: 'd-tira', code: '6001', name: 'Тирамису', price: 2800, vat: 16, groupId: 'g-dessert', color: '#e0a3a3' },
  { id: 'd-cali', code: '6002', name: 'Калифорния (ролл)', price: 3588, vat: 16, groupId: 'g-dessert', color: '#e0a3a3' },
  // Товары (розница)
  { id: 'd-pack', code: '7001', name: 'Пакет', price: 50, vat: 16, groupId: 'g-goods' },
  { id: 'd-merch', code: '7002', name: 'Кружка с логотипом', price: 3500, vat: 16, groupId: 'g-goods' },
  // Услуги
  { id: 'd-deliv', code: '9001', name: 'Доставка', price: 1000, vat: 0, groupId: 'g-service' },
  { id: 'd-cork', code: '9002', name: 'Пробковый сбор', price: 2000, vat: 16, groupId: 'g-service' },
]

// Поиск по названию или коду (артикулу).
export const searchDishes = (q: string) => {
  const s = q.trim().toLowerCase()
  if (!s) return []
  return dishes.filter((d) => d.name.toLowerCase().includes(s) || d.code.includes(s))
}

export const dishesByGroup = (groupId: string) => dishes.filter((d) => d.groupId === groupId)
export const groupsByPage = (page: number) => menuGroups.filter((g) => g.page === page)
export const findDish = (id: string) => dishes.find((d) => d.id === id)
export const findModifierGroup = (id: string) => modifierGroups.find((m) => m.id === id)
