import { useState } from 'react'
import { usePos } from '../store/pos'
import { halls, tablesByHall } from '../mock/data'

interface Props { orderId: number; onClose: () => void; onMoved: () => void }

// Перенос заказа на другой стол / объединение с заказом другого стола (FRONT_03 §1.7).
export default function TransferModal({ orderId, onClose, onMoved }: Props) {
  const { orders, moveOrderToTable, mergeOrderInto } = usePos()
  const [hallId, setHallId] = useState(halls[0].id)

  const orderOnTable = (tableId: string) => orders.find((o) => o.tableId === tableId && o.id !== orderId)

  const pick = (tableId: string) => {
    const existing = orderOnTable(tableId)
    if (existing) {
      if (!confirm(`На столе уже есть заказ №${existing.id}. Объединить?`)) return
      mergeOrderInto(orderId, existing.id) // переносим позиции в заказ стола
    } else {
      moveOrderToTable(orderId, tableId, hallId)
    }
    onMoved()
  }

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
      <div className="bg-white text-gray-800 rounded-lg p-5 w-[560px]">
        <div className="text-lg font-semibold mb-3">Перенести заказ на стол</div>
        <div className="flex gap-2 mb-3">
          {halls.map((h) => (
            <button key={h.id} onClick={() => setHallId(h.id)}
              className={`px-3 h-9 rounded-md ${hallId === h.id ? 'bg-pos-blue text-white' : 'bg-gray-200'}`}>{h.name}</button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {tablesByHall(hallId).map((t) => {
            const occ = orderOnTable(t.id)
            return (
              <button key={t.id} onClick={() => pick(t.id)}
                className={`h-16 rounded-md flex flex-col items-center justify-center ${occ ? 'bg-pos-accent text-black' : 'bg-gray-100'}`}>
                <span className="font-bold">{t.no}</span>
                <span className="text-xs opacity-60">{occ ? 'объединить' : 'свободен'}</span>
              </button>
            )
          })}
        </div>
        <button onClick={onClose} className="mt-4 h-11 w-full rounded-md bg-gray-200">Отмена</button>
      </div>
    </div>
  )
}
