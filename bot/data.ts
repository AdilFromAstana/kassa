// Демо-день ресторана для бота: закрытые чеки + остатки склада.
// Формат совпадает с доменом iiko-pos (поля, которые читают селекторы из ../src/lib).

const WAITERS = ['Петров К.С.', 'Иванова А.А.', 'Легасов И.Н.']
const DISHES = [
  { name: 'Бешбармак астау', price: 70000 },
  { name: 'Казан-плов', price: 20000 },
  { name: 'Манты (5 шт)', price: 4500 },
  { name: 'Лагман', price: 5000 },
  { name: 'Калифорния (ролл)', price: 3588 },
  { name: 'Стейк рибай', price: 18000 },
  { name: 'Эспрессо', price: 900 },
  { name: 'Капучино', price: 1495 },
  { name: 'Кола 0.5', price: 800 },
]
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)]
const pad = (n: number) => String(n).padStart(2, '0')

export interface DemoDay {
  date: string
  closedOrders: any[]
  ingredients: any[]
  commissionPct: number
}

// Генерирует ~count чеков за сегодня (час 11–23, пики в обед/ужин).
export function buildDemoDay(count = 52): DemoDay {
  const now = new Date()
  const dmy = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`
  const closedOrders: any[] = []
  for (let i = 0; i < count; i++) {
    // больше чеков в 13:00 и 19:00
    const peak = Math.random() < 0.5 ? 13 : 19
    const hour = Math.random() < 0.55 ? peak + (Math.random() < 0.5 ? 0 : 1) : 11 + Math.floor(Math.random() * 12)
    const min = Math.floor(Math.random() * 60)
    const nLines = 1 + Math.floor(Math.random() * 3)
    const lines: any[] = []
    for (let j = 0; j < nLines; j++) {
      const d = pick(DISHES)
      const qty = 1 + Math.floor(Math.random() * 2)
      lines.push({ uid: `${i}-${j}`, dishId: d.name, name: d.name, price: d.price, vat: 16, qty, modifiers: [] })
    }
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0)
    closedOrders.push({
      id: 1000 + i,
      waiter: pick(WAITERS),
      guests: 1 + Math.floor(Math.random() * 4),
      paidAt: `${dmy}, ${pad(Math.min(23, hour))}:${pad(min)}`,
      total,
      payments: [{ name: Math.random() < 0.5 ? 'Наличные' : 'Карта', amount: total }],
      lines,
    })
  }
  // остатки: пара позиций специально низкие/нулевые, чтобы показать алерты
  const ingredients = [
    { id: 'i-beef', name: 'Говядина', unit: 'кг', stock: 20, costPerUnit: 4000, min: 4 },
    { id: 'i-rice', name: 'Рис', unit: 'кг', stock: 25, costPerUnit: 600, min: 5 },
    { id: 'i-salmon', name: 'Лосось', unit: 'кг', stock: 0, costPerUnit: 8000, min: 1 },
    { id: 'i-cream', name: 'Сливки', unit: 'л', stock: 0.5, costPerUnit: 1500, min: 1 },
    { id: 'i-coffee', name: 'Кофе зерно', unit: 'кг', stock: 0.8, costPerUnit: 7000, min: 1 },
    { id: 'i-milk', name: 'Молоко', unit: 'л', stock: 25, costPerUnit: 450, min: 5 },
  ]
  return { date: dmy, closedOrders, ingredients, commissionPct: 3 }
}

// Демо-явки сотрудников (приход/уход) — для блока «Приход/уход».
export function demoAttendance() {
  return [
    { staff: 'Петров К.С.', position: 'Кассир', in: '08:55', out: '', plan: '09:00', late: 0 },
    { staff: 'Иванова А.А.', position: 'Официант', in: '09:12', out: '', plan: '09:00', late: 12 },
    { staff: 'Легасов И.Н.', position: 'Официант', in: '10:40', out: '', plan: '11:00', late: 0 },
    { staff: 'Сапарова Г.', position: 'Повар', in: '', out: '', plan: '08:00', late: 0, absent: true },
  ]
}
