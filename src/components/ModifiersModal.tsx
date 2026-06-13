import { useMemo, useState } from 'react'
import type { Dish, SelectedModifier } from '../types'
import { findModifierGroup } from '../mock/menu'
import { usePos, isOptionStopped } from '../store/pos'
import { formatTenge } from '../lib/money'

interface Props {
  dish: Dish
  onConfirm: (mods: SelectedModifier[]) => void
  onCancel: () => void
}

// Окно выбора модификаторов блюда (последовательно по группам, как в iikoFront).
export default function ModifiersModal({ dish, onConfirm, onCancel }: Props) {
  const groups = useMemo(
    () => (dish.modifierGroupIds ?? []).map(findModifierGroup).filter(Boolean) as NonNullable<ReturnType<typeof findModifierGroup>>[],
    [dish],
  )
  const stopList = usePos((s) => s.stopList)
  const [step, setStep] = useState(0)
  const [picked, setPicked] = useState<Record<string, number>>({}) // optionId -> qty
  const group = groups[step]

  const inGroupCount = group.options.reduce((s, o) => s + (picked[o.id] ?? 0), 0)
  const canNext = inGroupCount >= group.min && inGroupCount <= group.max

  const change = (optionId: string, delta: number) => {
    setPicked((p) => {
      const cur = p[optionId] ?? 0
      const total = group.options.reduce((s, o) => s + (o.id === optionId ? cur + delta : (p[o.id] ?? 0)), 0)
      if (delta > 0 && total > group.max) return p
      const v = Math.max(0, cur + delta)
      return { ...p, [optionId]: v }
    })
  }

  const finish = () => {
    const mods: SelectedModifier[] = []
    for (const g of groups) {
      for (const o of g.options) {
        const qty = picked[o.id] ?? 0
        if (qty > 0) mods.push({ optionId: o.id, name: o.name, price: o.price, qty })
      }
    }
    onConfirm(mods)
  }

  const next = () => (step < groups.length - 1 ? setStep(step + 1) : finish())

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
      <div className="bg-white text-gray-800 rounded-lg p-5 w-[460px] flex flex-col gap-3">
        <div className="text-base">
          <span className="text-gray-500">{dish.name} · </span>
          Группа «<b>{group.name}</b>»
        </div>
        <div className="flex flex-col gap-2 max-h-[50vh] overflow-auto">
          {group.options.map((o) => {
            const stopped = isOptionStopped(stopList, o.id)
            return (
              <div key={o.id} className={`flex items-center justify-between border border-gray-200 rounded-md px-3 h-12 ${stopped ? 'opacity-50' : ''}`}>
                <div>{o.name}{o.price > 0 && <span className="text-gray-400 text-sm"> · +{formatTenge(o.price)}</span>}{stopped && <span className="ml-2 text-xs bg-pos-rose text-gray-900 rounded px-1">стоп</span>}</div>
                <div className="flex items-center gap-3">
                  <button disabled={stopped} className="pad-key w-9 h-9 disabled:opacity-30" onClick={() => change(o.id, -1)}>−</button>
                  <span className="w-5 text-center">{picked[o.id] ?? 0}</span>
                  <button disabled={stopped} className="pad-key w-9 h-9 disabled:opacity-30" onClick={() => change(o.id, +1)}>+</button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="text-sm text-gray-500">
          Минимум: {group.min} · Максимум: {group.max} · Введено: {inGroupCount}
          {groups.length > 1 && <span> · шаг {step + 1}/{groups.length}</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 h-12 rounded-md bg-gray-200">Отмена</button>
          <button onClick={() => setPicked({})} className="flex-1 h-12 rounded-md bg-gray-200">Очистить</button>
          <button disabled={!canNext} onClick={next}
            className={`flex-1 h-12 rounded-md text-white ${canNext ? 'bg-pos-green' : 'bg-gray-400'}`}>
            {step < groups.length - 1 ? 'Далее' : 'ОК'}
          </button>
        </div>
      </div>
    </div>
  )
}
