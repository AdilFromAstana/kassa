import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { Ban } from 'lucide-react'
import { usePos } from '../store/pos'
import { menuGroups, dishesByGroup } from '../mock/menu'
import TopBar from '../components/TopBar'

// Стоп-лист (СЕРВИС → Стоп-лист): снятие/возврат блюд в продажу. Снятые недоступны на экране заказа.
export default function StopListScreen() {
  const navigate = useNavigate()
  const { stopList, toggleStop } = usePos()

  return (
    <div className="h-full flex flex-col bg-pos-bg text-white">
      <TopBar title="Стоп-лист" />
      <div className="px-6 pt-4 text-white/60 text-sm">
        В стопе: <b className="text-pos-rose">{stopList.length}</b> поз. Нажмите блюдо, чтобы снять с продажи / вернуть.
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 gap-6 max-w-4xl">
          {menuGroups.map((g) => {
            const items = dishesByGroup(g.id)
            if (items.length === 0) return null
            return (
              <div key={g.id}>
                <div className="text-pos-accent text-sm uppercase mb-2">{g.name}</div>
                <div className="flex flex-col gap-1">
                  {items.map((d) => {
                    const stopped = stopList.includes(d.id)
                    return (
                      <button key={d.id} onClick={() => toggleStop(d.id)}
                        className={`flex items-center justify-between h-11 px-3 rounded-md ${stopped ? 'bg-pos-rose/40 text-pos-rose' : 'bg-white/5 hover:bg-white/10'}`}>
                        <span className={stopped ? 'line-through' : ''}>{d.name}</span>
                        <span className="text-xs flex items-center gap-1">{stopped ? <><Ban size={12} /> в стопе</> : 'в продаже'}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="h-16 bg-white text-gray-700 flex items-center px-4">
        <BackButton onClick={() => navigate('/menu')} />
      </div>
    </div>
  )
}
