import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { Ban, Trash2 } from 'lucide-react'
import { usePos } from '../store/pos'
import { menuGroups, dishesByGroup, findDish } from '../mock/menu'
import TopBar from '../components/TopBar'
import QuantityModal from '../components/QuantityModal'

// Стоп-лист (СЕРВИС → Стоп-лист) — 1:1 с iikoFront: слева снятые позиции с остатком/кто/когда,
// справа меню для добавления. Полный стоп = недоступно; остаток N — продаётся, тает при оплате, при 0 → стоп.
export default function StopListScreen() {
  const navigate = useNavigate()
  const { stopList, addStop, removeStop, setStopRemaining, can } = usePos()
  const canEdit = can('F_EM') // «Редактировать стоп-лист и быстрое меню» — обычно у менеджера
  const [editId, setEditId] = useState<string | null>(null)

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Стоп-лист" />
      {!canEdit && (
        <div className="bg-pos-rose/30 text-pos-rose text-sm px-5 py-2 flex items-center gap-2">
          <Ban size={14} /> Нет права «Редактировать стоп-лист» (F_EM) — только просмотр. Изменения вносит менеджер.
        </div>
      )}
      <div className="flex-1 flex overflow-hidden">
        {/* слева — позиции в стоп-листе */}
        <div className="w-[42%] border-r border-white/10 flex flex-col">
          <div className="px-5 py-3 text-xs uppercase text-pos-accent bg-black/30">В стоп-листе: {stopList.length}</div>
          <div className="flex-1 overflow-auto">
            {stopList.length === 0 && (
              <div className="p-5 text-white/40 text-sm">Стоп-лист пуст. Выберите блюдо справа, чтобы снять с продажи.</div>
            )}
            {stopList.map((s) => {
              const d = findDish(s.dishId)
              const out = s.remaining === undefined || s.remaining <= 0
              return (
                <div key={s.dishId} className="flex items-center gap-3 px-4 h-16 border-b border-white/10">
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{d?.name ?? s.dishId}</div>
                    <div className="text-xs text-white/40">{s.byName} · {s.at}</div>
                  </div>
                  <button onClick={() => setEditId(s.dishId)} disabled={!canEdit}
                    className={`h-9 px-3 rounded text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${out ? 'bg-pos-rose/40 text-pos-rose' : 'bg-white/10 hover:bg-white/20'}`}>
                    {out ? <span className="inline-flex items-center gap-1"><Ban size={12} /> стоп</span> : `остаток: ${s.remaining}`}
                  </button>
                  <button onClick={() => removeStop(s.dishId)} disabled={!canEdit} className="text-white/50 hover:text-pos-rose disabled:opacity-30 disabled:cursor-not-allowed" title="Вернуть в продажу"><Trash2 size={18} /></button>
                </div>
              )
            })}
          </div>
        </div>

        {/* справа — меню для добавления */}
        <div className="flex-1 overflow-auto p-5">
          <div className="text-white/50 text-sm mb-3">Нажмите блюдо, чтобы снять с продажи (полный стоп). Остаток порций задаётся слева.</div>
          <div className="grid grid-cols-2 gap-5">
            {menuGroups.map((g) => {
              const items = dishesByGroup(g.id)
              if (!items.length) return null
              return (
                <div key={g.id}>
                  <div className="text-pos-accent text-sm uppercase mb-2">{g.name}</div>
                  <div className="flex flex-col gap-1">
                    {items.map((d) => {
                      const inStop = stopList.some((s) => s.dishId === d.id)
                      return (
                        <button key={d.id} disabled={inStop || !canEdit} onClick={() => addStop(d.id)}
                          className={`flex items-center justify-between h-11 px-3 rounded-md ${inStop || !canEdit ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10'}`}>
                          <span>{d.name}</span>
                          {inStop && <span className="text-xs text-pos-rose inline-flex items-center gap-1"><Ban size={12} /> в стопе</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>

      {editId && (
        <QuantityModal
          dishName={`Остаток: ${findDish(editId)?.name ?? ''}`}
          unit="ПОРЦ"
          value={stopList.find((s) => s.dishId === editId)?.remaining ?? 0}
          onOk={(n) => { setStopRemaining(editId, n); setEditId(null) }}
          onCancel={() => setEditId(null)}
        />
      )}
    </div>
  )
}
