// Telegram-бот iiko-pos (модуль B): long-polling + кнопки-отчёты + авто-сводка на закрытии смены.
// Запуск: cd bot && npm i && npm start   (токен — в bot/.env)
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { buildDemoDay } from './data'
import {
  summaryBlock, topDishesBlock, footfallBlock, bestWaiterBlock,
  commissionBlock, lowStockBlock, attendanceBlock, shiftCloseSummary,
} from './reports'

// ── токен из .env (никогда не хардкодим) ──
function readEnv(key: string): string {
  if (process.env[key]) return process.env[key] as string
  try {
    for (const line of readFileSync(new URL('./.env', import.meta.url), 'utf8').split('\n')) {
      const m = /^([A-Z_]+)=(.*)$/.exec(line.trim())
      if (m && m[1] === key) return m[2]
    }
  } catch { /* ignore */ }
  return ''
}
const TOKEN = readEnv('BOT_TOKEN')
if (!TOKEN) { console.error('Нет BOT_TOKEN (bot/.env)'); process.exit(1) }
const API = `https://api.telegram.org/bot${TOKEN}`

// ── подписчики (chat_id) — persist в bot/subscribers.json ──
const SUBS_FILE = new URL('./subscribers.json', import.meta.url)
const loadSubs = (): number[] => { try { return JSON.parse(readFileSync(SUBS_FILE, 'utf8')) } catch { return [] } }
const saveSubs = (s: number[]) => writeFileSync(SUBS_FILE, JSON.stringify([...new Set(s)]))
let subs = loadSubs()

// ── демо-день (стабилен в рамках сессии; пересоздаётся на «закрытии смены») ──
let day = buildDemoDay()

// ── Telegram API через fetch ──
async function tg(method: string, body: any) {
  const r = await fetch(`${API}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return r.json() as Promise<any>
}

const KEYBOARD = {
  inline_keyboard: [
    [{ text: '💰 Сводка смены', callback_data: 'summary' }, { text: '🥇 Топ-5 блюд', callback_data: 'top' }],
    [{ text: '👥 Проходимость', callback_data: 'footfall' }, { text: '🏆 Официанты', callback_data: 'waiters' }],
    [{ text: '💸 Комиссия 3%', callback_data: 'commission' }, { text: '📦 Остатки', callback_data: 'stock' }],
    [{ text: '🕒 Приход / уход', callback_data: 'attendance' }, { text: '🔔 Сводка закрытия', callback_data: 'shiftclose' }],
  ],
}
const BLOCKS: Record<string, () => string> = {
  summary: () => summaryBlock(day), top: () => topDishesBlock(day), footfall: () => footfallBlock(day),
  waiters: () => bestWaiterBlock(day), commission: () => commissionBlock(day), stock: () => lowStockBlock(day),
  attendance: () => attendanceBlock(day), shiftclose: () => shiftCloseSummary(day),
}

const send = (chat: number, text: string, withKb = true) =>
  tg('sendMessage', { chat_id: chat, text, parse_mode: 'HTML', reply_markup: withKb ? KEYBOARD : undefined })

async function broadcast(text: string) { for (const c of subs) await send(c, text) }

// ── обработка апдейтов ──
async function handleUpdate(u: any) {
  if (u.message?.text) {
    const chat = u.message.chat.id
    const t = u.message.text.trim()
    if (t.startsWith('/start')) {
      if (!subs.includes(chat)) { subs.push(chat); saveSubs(subs) }
      await send(chat, `👋 ${'<b>iiko-pos · сводки заведения</b>'}\n\nВы подписаны на авто-сводку при закрытии смены.\nВыберите отчёт 👇`)
    } else if (t.startsWith('/stop')) {
      subs = subs.filter((c) => c !== chat); saveSubs(subs)
      await send(chat, 'Отписаны от авто-сводок.', false)
    } else {
      await send(chat, 'Выберите отчёт 👇')
    }
  } else if (u.callback_query) {
    const cq = u.callback_query
    const chat = cq.message.chat.id
    await tg('answerCallbackQuery', { callback_query_id: cq.id })
    const fn = BLOCKS[cq.data]
    if (fn) await send(chat, fn())
  }
}

// ── HTTP-хук: фронт (закрытие смены) → авто-сводка подписчикам ──
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/notify/shift-closed') {
    day = buildDemoDay() // «новая закрытая смена» (в реале — данные из тела запроса)
    broadcast(shiftCloseSummary(day)).then(() => { res.writeHead(200); res.end('ok') })
    return
  }
  res.writeHead(req.url === '/health' ? 200 : 404); res.end(req.url === '/health' ? 'ok' : '')
}).listen(7799, () => console.log('HTTP hook: http://localhost:7799/notify/shift-closed'))

// ── long-polling ──
let offset = 0
async function poll() {
  try {
    const r = await tg('getUpdates', { offset, timeout: 30 })
    if (r.ok) for (const u of r.result) { offset = u.update_id + 1; await handleUpdate(u) }
  } catch (e) { console.error('poll err', String(e).split('\n')[0]); await new Promise((s) => setTimeout(s, 2000)) }
  poll()
}

const me = await tg('getMe', {})
console.log(`Бот запущен: @${me.result?.username} · подписчиков: ${subs.length}`)
poll()
