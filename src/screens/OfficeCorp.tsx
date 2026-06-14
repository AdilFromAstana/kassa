import { useState } from 'react'
import { Trash2, Building2, Boxes, Store, Warehouse, Plus } from 'lucide-react'
import { usePos } from '../store/pos'
import { printToast } from '../lib/print'
import Tabs from '../components/Tabs'
import type { SyncPoint, CorpTree } from '../types'

const cloneTree = (t: CorpTree): CorpTree => JSON.parse(JSON.stringify(t))
const uid = (p: string) => p + '-' + Math.random().toString(36).slice(2, 8)

// Корпорация (модуль 02) — структура сети, общие настройки, нумерация документов, концепции, монитор синхронизации.
type Tab = 'structure' | 'numbering' | 'concepts' | 'sync'

const SYNC: Record<SyncPoint['status'], { label: string; cls: string }> = {
  ok: { label: 'Нормальная работа', cls: 'bg-emerald-100 text-emerald-700' },
  requested: { label: 'Обмен запрошен', cls: 'bg-blue-100 text-blue-700' },
  skipped: { label: 'Пропущен обмен', cls: 'bg-amber-100 text-amber-700' },
  error: { label: 'Ошибка обмена', cls: 'bg-rose-100 text-rose-700' },
}

export default function OfficeCorp() {
  const pos = usePos()
  const [tab, setTab] = useState<Tab>('structure')
  const [newCn, setNewCn] = useState({ code: '', name: '', group: '' })
  const c = pos.corpSettings
  const tree = pos.corpTree
  // CRUD структуры: считаем новое дерево в компоненте и сохраняем целиком (store.setCorpTree)
  const commit = (mut: (t: CorpTree) => void) => { const t = cloneTree(tree); mut(t); pos.setCorpTree(t) }
  const eInput = 'h-8 rounded border border-transparent hover:border-gray-200 focus:border-emerald-400 px-1 bg-transparent focus:bg-white outline-none'

  return (
    <div className="p-6 max-w-4xl">
      <div className="text-xs text-gray-500 mb-4">Корпорация (модуль 02) — структура сети, общие настройки учёта, нумерация документов, концепции, монитор синхронизации ЦО↔ТП.</div>
      <Tabs active={tab} onChange={setTab} items={[
        { id: 'structure', label: 'Структура и настройки' }, { id: 'numbering', label: 'Нумерация документов' }, { id: 'concepts', label: 'Концепции' }, { id: 'sync', label: 'Монитор синхронизации' },
      ]} />

      {tab === 'structure' && (
        <div className="grid grid-cols-2 gap-4">
          {/* дерево структуры сети — редактируемый CRUD */}
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="flex items-center mb-3">
              <div className="text-gray-500 text-xs uppercase">Структура сети</div>
              <button onClick={() => commit((t) => t.legal.push({ id: uid('le'), name: 'Новое юрлицо', bin: '', divisions: [] }))}
                className="ml-auto h-7 px-2 rounded bg-emerald-500 text-white text-xs flex items-center gap-1"><Plus size={13} />Юрлицо</button>
            </div>
            <div className="text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Building2 size={15} className="text-emerald-600 shrink-0" />
                <input value={tree.name} onChange={(e) => commit((t) => { t.name = e.target.value })} className={`${eInput} flex-1 font-medium`} />
              </div>
              {tree.legal.map((le) => (
                <div key={le.id} className="ml-3 mt-1 border-l border-gray-100 pl-2">
                  <div className="flex items-center gap-1 group">
                    <Boxes size={14} className="text-slate-500 shrink-0" />
                    <input value={le.name} onChange={(e) => commit((t) => { const x = t.legal.find((y) => y.id === le.id); if (x) x.name = e.target.value })} className={`${eInput} flex-1`} />
                    <input value={le.bin} onChange={(e) => commit((t) => { const x = t.legal.find((y) => y.id === le.id); if (x) x.bin = e.target.value.replace(/\D/g, '').slice(0, 12) })} placeholder="БИН" className={`${eInput} w-28 text-xs font-mono text-gray-500`} />
                    <button onClick={() => commit((t) => { const dv = t.legal.find((y) => y.id === le.id)?.divisions; if (dv) dv.push({ id: uid('dv'), name: 'Подразделение', points: [] }) })} className="opacity-0 group-hover:opacity-100 text-emerald-600" title="Добавить подразделение"><Plus size={14} /></button>
                    <button onClick={() => commit((t) => { t.legal = t.legal.filter((y) => y.id !== le.id) })} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                  {le.divisions.map((dv) => (
                    <div key={dv.id} className="ml-4 mt-1 border-l border-gray-100 pl-2">
                      <div className="flex items-center gap-1 group">
                        <Boxes size={13} className="text-slate-400 shrink-0" />
                        <input value={dv.name} onChange={(e) => commit((t) => { const x = t.legal.find((y) => y.id === le.id)?.divisions.find((z) => z.id === dv.id); if (x) x.name = e.target.value })} className={`${eInput} flex-1 text-gray-700`} />
                        <button onClick={() => commit((t) => { const pts = t.legal.find((y) => y.id === le.id)?.divisions.find((z) => z.id === dv.id)?.points; if (pts) pts.push({ id: uid('pt'), name: 'Торговое предприятие', warehouses: [] }) })} className="opacity-0 group-hover:opacity-100 text-emerald-600" title="Добавить ТП"><Plus size={14} /></button>
                        <button onClick={() => commit((t) => { const x = t.legal.find((y) => y.id === le.id); if (x) x.divisions = x.divisions.filter((z) => z.id !== dv.id) })} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                      {dv.points.map((p) => (
                        <div key={p.id} className="ml-4 mt-1 border-l border-gray-100 pl-2">
                          <div className="flex items-center gap-1 group">
                            <Store size={13} className="text-blue-500 shrink-0" />
                            <input value={p.name} onChange={(e) => commit((t) => { const x = t.legal.find((y) => y.id === le.id)?.divisions.find((z) => z.id === dv.id)?.points.find((q) => q.id === p.id); if (x) x.name = e.target.value })} className={`${eInput} flex-1 text-gray-700`} />
                            <button onClick={() => commit((t) => { const whs = t.legal.find((y) => y.id === le.id)?.divisions.find((z) => z.id === dv.id)?.points.find((q) => q.id === p.id)?.warehouses; if (whs) whs.push({ id: uid('wh'), name: 'Склад' }) })} className="opacity-0 group-hover:opacity-100 text-emerald-600" title="Добавить склад"><Plus size={14} /></button>
                            <button onClick={() => commit((t) => { const x = t.legal.find((y) => y.id === le.id)?.divisions.find((z) => z.id === dv.id); if (x) x.points = x.points.filter((q) => q.id !== p.id) })} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                          </div>
                          {p.warehouses.map((w) => (
                            <div key={w.id} className="ml-5 flex items-center gap-1 group text-gray-500 text-xs">
                              <Warehouse size={11} className="shrink-0" />
                              <input value={w.name} onChange={(e) => commit((t) => { const x = t.legal.find((y) => y.id === le.id)?.divisions.find((z) => z.id === dv.id)?.points.find((q) => q.id === p.id)?.warehouses.find((u) => u.id === w.id); if (x) x.name = e.target.value })} className={`${eInput} flex-1 text-xs`} />
                              <button onClick={() => commit((t) => { const x = t.legal.find((y) => y.id === le.id)?.divisions.find((z) => z.id === dv.id)?.points.find((q) => q.id === p.id); if (x) x.warehouses = x.warehouses.filter((u) => u.id !== w.id) })} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500"><Trash2 size={11} /></button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-400 mt-3">Наведите на узел → «＋» добавить дочерний, корзина — удалить. Имена правятся на месте.</div>
          </div>

          {/* общие настройки корпорации */}
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="text-gray-500 text-xs uppercase mb-3">Общие настройки</div>
            <label className="flex flex-col text-xs text-gray-500 mb-2">Название корпорации
              <input value={c.name} onChange={(e) => pos.setCorpSettings({ name: e.target.value })} className="mt-1 h-9 rounded border border-gray-300 px-2 text-sm" /></label>
            <label className="flex flex-col text-xs text-gray-500 mb-2">БИН
              <input value={c.bin} onChange={(e) => pos.setCorpSettings({ bin: e.target.value.replace(/\D/g, '').slice(0, 12) })} className="mt-1 h-9 rounded border border-gray-300 px-2 text-sm font-mono" /></label>
            <div className="flex gap-2 mb-2">
              <label className="flex flex-col text-xs text-gray-500 flex-1">Валюта
                <input value={c.currency} onChange={(e) => pos.setCorpSettings({ currency: e.target.value })} className="mt-1 h-9 rounded border border-gray-300 px-2 text-sm" /></label>
              <label className="flex flex-col text-xs text-gray-500 w-16">Символ
                <input value={c.symbol} onChange={(e) => pos.setCorpSettings({ symbol: e.target.value })} className="mt-1 h-9 rounded border border-gray-300 px-2 text-sm text-center" /></label>
              <label className="flex flex-col text-xs text-gray-500 w-24">Точность
                <select value={c.precision} onChange={(e) => pos.setCorpSettings({ precision: Number(e.target.value) })} className="mt-1 h-9 rounded border border-gray-300 px-2 text-sm">
                  <option value={0}>0</option><option value={2}>2</option><option value={4}>4</option>
                </select></label>
            </div>
            <label className="flex items-center gap-2 text-sm mt-2">
              <input type="checkbox" checked={c.roundToWhole} onChange={(e) => pos.setCorpSettings({ roundToWhole: e.target.checked })} />
              Округлять стоимость заказа до целого в пользу гостя
            </label>
            <div className="text-xs text-gray-400 mt-2">🇰🇿 Валюта учёта — тенге ₸; ҚҚС 16%; идентификатор — БИН.</div>
          </div>
        </div>
      )}

      {tab === 'numbering' && (
        <>
          <div className="text-xs text-gray-400 mb-2">Шаблон: реквизиты <code>{'{D}'}</code> код подразделения, <code>{'{yyyy}'}</code>/<code>{'{mm}'}</code> дата, <code>#</code> счётчик (число знаков = мин. цифр).</div>
          <div className="bg-white border border-gray-200 rounded-md overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Тип документа</th><th>Шаблон</th><th className="text-right">Счётчик</th><th>Пример</th></tr></thead>
              <tbody>
                {pos.docNumbering.map((d) => {
                  const example = d.template.replace('{D}', '1').replace('{yyyy}', '2026').replace('{yy}', '26').replace('{mm}', '06').replace('{m}', '6').replace('{dd}', '14').replace('{d}', '14').replace('#', String(d.counter + 1).padStart(4, '0'))
                  return (
                    <tr key={d.id} className="border-b border-gray-100 last:border-0">
                      <td className="p-2">{d.docType}</td>
                      <td><input value={d.template} onChange={(e) => pos.setDocTemplate(d.id, e.target.value)} className="h-8 w-48 rounded border border-gray-200 px-2 font-mono text-xs" /></td>
                      <td className="text-right text-gray-500">{d.counter}</td>
                      <td className="text-gray-500 font-mono text-xs">{example}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'concepts' && (
        <>
          <div className="text-xs text-gray-400 mb-2">Концепция — аналитический признак (бренд/тип обслуживания) для детализации выручки/расходов и P&L по точке.</div>
          <div className="bg-white border border-gray-200 rounded-md overflow-auto mb-3 max-w-2xl">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Код</th><th>Название</th><th>Номенклатурная группа</th><th className="p-2"></th></tr></thead>
              <tbody>
                {pos.concepts.map((cn) => (
                  <tr key={cn.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-2 font-mono">{cn.code}</td>
                    <td>{cn.name}</td>
                    <td className="text-gray-500">{cn.group}</td>
                    <td className="p-2 text-right"><button onClick={() => pos.removeConcept(cn.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-end gap-2">
            <input value={newCn.code} onChange={(e) => setNewCn({ ...newCn, code: e.target.value.toUpperCase() })} placeholder="КОД" className="h-9 w-24 rounded border border-gray-300 px-2 font-mono text-sm" />
            <input value={newCn.name} onChange={(e) => setNewCn({ ...newCn, name: e.target.value })} placeholder="Название" className="h-9 rounded border border-gray-300 px-2 text-sm flex-1" />
            <input value={newCn.group} onChange={(e) => setNewCn({ ...newCn, group: e.target.value })} placeholder="Ном. группа" className="h-9 rounded border border-gray-300 px-2 text-sm" />
            <button onClick={() => { if (newCn.code.trim() && newCn.name.trim()) { pos.addConcept(newCn.code.trim(), newCn.name.trim(), newCn.group.trim()); setNewCn({ code: '', name: '', group: '' }) } }} className="h-9 px-4 rounded bg-emerald-500 text-white text-sm">Добавить</button>
          </div>
        </>
      )}

      {tab === 'sync' && (
        <>
          <div className="text-xs text-gray-400 mb-2">Статус обмена данными ЦО↔ТП. «Экстр. обмен» — принудительная синхронизация выбранной точки.</div>
          <div className="bg-white border border-gray-200 rounded-md overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-left border-b border-gray-200"><th className="p-2">Торговое предприятие</th><th>Статус</th><th>Последний импорт</th><th>Последний экспорт</th><th className="p-2 text-right">Действие</th></tr></thead>
              <tbody>
                {pos.syncMonitor.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 last:border-0">
                    <td className="p-2">{p.point}</td>
                    <td><span className={`text-xs px-2 py-0.5 rounded-full ${SYNC[p.status].cls}`}>{SYNC[p.status].label}</span></td>
                    <td className="text-gray-500 text-xs">{p.lastImport}</td>
                    <td className="text-gray-500 text-xs">{p.lastExport}</td>
                    <td className="p-2 text-right"><button onClick={() => { pos.requestSync(p.id); printToast(`Экстр. обмен с «${p.point}» выполнен`) }} className="h-7 px-3 rounded bg-blue-600 text-white text-xs">Экстр. обмен</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-gray-500 text-xs uppercase mt-5 mb-2">Лог синхронизации</div>
          <div className="bg-white border border-gray-200 rounded-md p-3 text-xs font-mono text-gray-600 space-y-0.5">
            <div>18:31:02 → экспорт «ТП Астана (центр)»: 1 240 объектов, ревизия 88142, 1.2 с — OK</div>
            <div>18:30:40 ← импорт «ТП Астана (центр)»: 312 объектов, ревизия 88141, 0.6 с — OK</div>
            <div>18:25:10 → экспорт «ТП Астана (Левый берег)»: запрошен оператором</div>
            <div className="text-amber-600">22:10:00 ⚠ «Центральный цех»: пропущен запланированный обмен</div>
          </div>
        </>
      )}
    </div>
  )
}
