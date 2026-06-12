interface Props {
  onKey: (digit: string) => void
  onBackspace: () => void
  onClear?: () => void
}

// Цифровая клавиатура (PIN, количество, суммы).
export default function NumPad({ onKey, onBackspace, onClear }: Props) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  return (
    <div className="grid grid-cols-3 gap-2 w-64">
      {keys.map((k) => (
        <button key={k} className="pad-key h-16" onClick={() => onKey(k)}>{k}</button>
      ))}
      <button className="pad-key h-16 text-base" onClick={onClear}>C</button>
      <button className="pad-key h-16" onClick={() => onKey('0')}>0</button>
      <button className="pad-key h-16 text-xl" onClick={onBackspace}>⌫</button>
    </div>
  )
}
