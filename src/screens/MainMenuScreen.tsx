import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, ListOrdered, Receipt, Puzzle, Wrench, Power, TriangleAlert } from 'lucide-react'
import { usePos } from '../store/pos'
import { attendance } from '../mock/data'
import { printToast } from '../lib/print'
import CashMovementModal from '../components/CashMovementModal'
import OpenShiftModal from '../components/OpenShiftModal'

// Экран доп. меню iikoFront (1-в-1 со скрином): блоки Денис/ГОСТИ/ПЕРСОНАЛ/СЕРВИС/КАССА.
type Cell = { label: string; onClick?: () => void; disabled?: boolean; accent?: boolean }

export default function MainMenuScreen() {
  const navigate = useNavigate()
  const pos = usePos()
  const { user, personalShift, cashShift, openCashShift, openPersonalShift, closePersonalShift, logout, startOrder } = pos
  const est = pos.establishment
  const isRest = est.mode === 'restaurant'
  const [cashModal, setCashModal] = useState<'in' | 'out' | null>(null)
  const [openShift, setOpenShift] = useState(false)
  const [onShift, setOnShift] = useState(false)
  // сотрудники на смене: явки с приходом и без ухода (отработано)
  const onShiftStaff = attendance.filter((a) => a.in && !a.out && a.type === 'Отработано')

  // нет кассира — на вход (иначе вверху «undefined»)
  useEffect(() => { if (!user) navigate('/') }, [user, navigate])

  const quickCheck = () => { startOrder({ tableId: null, hallId: null, guests: 1, type: 'takeaway' }); navigate('/order') }
  const switchCashier = () => { logout(); navigate('/') } // кассовая смена остаётся открытой
  const openPersonal = () => { if (user) openPersonalShift(user.positions[0]) }

  const Tile = ({ c }: { c: Cell }) => (
    <button disabled={c.disabled} onClick={c.onClick}
      className={`w-full bg-white text-gray-800 text-sm flex items-center justify-center text-center px-2 min-h-[64px]
        border border-gray-300 active:bg-gray-100 ${c.disabled ? 'opacity-40 cursor-not-allowed' : ''} ${c.accent ? 'text-pos-green font-semibold' : ''}`}>
      {c.label}
    </button>
  )

  const Header = ({ title, color }: { title: string; color: string }) => (
    <div className="text-white font-semibold text-center py-2" style={{ background: color }}>{title}</div>
  )

  return (
    <div className="h-full flex flex-col bg-pos-bg">
      {/* шапка: статус смены + замок */}
      <div className="h-14 bg-white flex items-center justify-between px-4 shrink-0">
        <div className="text-xs text-gray-500">iiko POS v0.1 (мок) · {new Date().toLocaleString('ru-RU')}</div>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>{cashShift ? 'Смена открыта' : 'Смена закрыта'}{user ? ` · ${user.name}` : ''}</span>
          <button onClick={() => { logout(); navigate('/') }} className="text-gray-700" title="Заблокировать"><Lock size={18} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 flex gap-4 items-start">
        {/* колонка 1: имя / личная смена */}
        <div className="w-56">
          <div className="border border-gray-300">
            <div className="text-white text-center py-2" style={{ background: '#6d5b8e' }}>
              <div className="font-semibold">{user?.name}</div>
              <div className="text-xs opacity-80">{personalShift ? `Смена открыта\n${personalShift.openedAt}` : 'Личная смена закрыта'}</div>
            </div>
            <div className="grid grid-cols-1">
              {personalShift
                ? <Tile c={{ label: 'Закрыть личную смену', onClick: () => { closePersonalShift(); navigate('/') } }} />
                : <Tile c={{ label: 'Открыть личную смену', onClick: openPersonal, accent: true }} />}
              <Tile c={{ label: 'Личная страница', onClick: () => navigate('/personal') }} />
              <Tile c={{ label: 'Сообщения', onClick: () => navigate('/messages') }} />
            </div>
          </div>

        </div>

        {/* колонка 2: ГОСТИ + ПЕРСОНАЛ */}
        <div className="w-56 flex flex-col gap-4">
          {est.banquets && (
            <div className="border border-gray-300">
              <Header title="ГОСТИ" color="#4f7aa3" />
              <Tile c={{ label: 'Банкеты и резервы', onClick: () => navigate('/banquets') }} />
            </div>
          )}

          <div className="border border-gray-300">
            <Header title="ПЕРСОНАЛ" color="#8a6fae" />
            <Tile c={{ label: `Сотрудники на смене (${onShiftStaff.length})`, onClick: () => setOnShift(true) }} />
            <Tile c={{ label: 'Редактировать явки', onClick: () => navigate('/attendance'), disabled: !pos.can('F_CVS') }} />
          </div>
        </div>

        {/* колонка 3: СЕРВИС */}
        <div className="w-56 border border-gray-300">
          <Header title="СЕРВИС" color="#4a9b86" />
          <div className="grid grid-cols-1">
            <Tile c={{ label: 'Отчеты', onClick: () => navigate('/reports'), disabled: !pos.can('F_VRPT') }} />
            <Tile c={{ label: 'Стоп-лист', onClick: () => navigate('/stoplist') }} />
            <Tile c={{ label: 'Документы', onClick: () => navigate('/documents') }} />
          </div>
        </div>

        {/* КАССА */}
        <div className="flex-1 border border-gray-300 max-w-2xl">
          <div className="flex">
            <div className="flex-1 text-white px-4 py-3 text-sm leading-relaxed" style={{ background: '#4a9b86' }}>
              Фискальных регистраторов: {est.frCount}<br />
              Кассовая смена<br />
              открыта на: {cashShift ? est.frCount : 0}<br />
              закрыта на: {cashShift ? 0 : est.frCount}
            </div>
            <button onClick={() => navigate('/fiscal/details')}
              className="w-48 bg-white text-gray-800 border-l border-gray-300 active:bg-gray-100">Подробнее…</button>
          </div>
          <div className="grid grid-cols-2">
            {(cashShift
              ? [ // смена ОТКРЫТА — «Открыть» скрыта (как в айке)
                  { label: 'Закрыть кассовую смену', onClick: () => navigate('/shift/close'), disabled: !pos.can('F_CS') },
                  { label: 'Внести деньги', onClick: () => setCashModal('in'), disabled: !pos.can('F_CASH') },
                  { label: 'Изъять деньги', onClick: () => setCashModal('out'), disabled: !pos.can('F_CASH') },
                  { label: 'Закрытые заказы', onClick: () => navigate('/orders/closed') },
                  { label: 'Заказы закрытых кассовых смен', onClick: () => navigate('/shifts/closed') },
                  { label: 'Открытые заказы', onClick: () => navigate('/orders/open') },
                  { label: 'Печать X-отчета', onClick: () => printToast('X-отчёт (без гашения)'), disabled: !pos.can('F_XR') },
                  { label: 'Команды фискальному регистратору', onClick: () => navigate('/fiscal/commands') },
                  { label: 'Сменить кассира', onClick: switchCashier },
                  { label: 'Чек коррекции', onClick: () => navigate('/correction'), disabled: !pos.can('F_OCS') },
                  { label: 'Возврат товаров', onClick: () => navigate('/orders/closed'), disabled: !pos.can('F_STRN') },
                ]
              : [ // смена ЗАКРЫТА — доступно только открытие + неоперационные
                  { label: 'Открыть кассовую смену', onClick: () => setOpenShift(true), accent: true, disabled: !pos.can('F_OCS') },
                  { label: 'Заказы закрытых кассовых смен', onClick: () => navigate('/shifts/closed') },
                  { label: 'Сменить кассира', onClick: switchCashier },
                ]
            ).map((c) => <Tile key={c.label} c={c} />)}
          </div>
        </div>
      </div>

      {/* нижняя панель: НАЗАД · ЗАКАЗЫ · Быстрый чек · ДОПОЛНЕНИЯ · ИНСТРУМЕНТЫ · выкл */}
      <div className="h-16 bg-[#1a1a1a] text-white flex items-center px-6 gap-8 shrink-0">
        <button onClick={() => (isRest ? navigate('/halls') : quickCheck())} disabled={!cashShift} className="flex flex-col items-center gap-1 text-xs disabled:opacity-30"><ListOrdered size={20} />ЗАКАЗЫ</button>
        {isRest && <button onClick={quickCheck} disabled={!cashShift} className="flex flex-col items-center gap-1 text-xs disabled:opacity-30"><Receipt size={20} />Быстрый чек</button>}
        <div className="ml-auto flex items-center gap-8 text-xs">
          <button onClick={() => navigate('/extras?kind=addons')} className="flex flex-col items-center gap-1"><Puzzle size={20} />ДОПОЛНЕНИЯ</button>
          <button onClick={() => navigate('/extras?kind=tools')} className="flex flex-col items-center gap-1"><Wrench size={20} />ИНСТРУМЕНТЫ</button>
          <button onClick={() => { logout(); navigate('/') }} className="text-white" title="Выход"><Power size={20} /></button>
        </div>
      </div>

      {!cashShift && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-pos-accent text-sm flex items-center gap-2"><TriangleAlert size={16} /> Кассовая смена не открыта — откройте её, чтобы принимать заказы</div>
      )}
      {onShift && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40" onClick={() => setOnShift(false)}>
          <div className="bg-white text-gray-800 rounded-lg w-[420px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b font-semibold">Сотрудники на смене · {onShiftStaff.length}</div>
            <div className="flex-1 overflow-auto">
              {onShiftStaff.length === 0 ? <div className="p-5 text-gray-400 text-sm">Нет открытых явок.</div> : (
                <table className="w-full text-sm">
                  <thead className="text-gray-400 text-left"><tr><th className="px-4 py-2">Сотрудник</th><th>Должность</th><th className="text-right px-4">Приход</th></tr></thead>
                  <tbody>
                    {onShiftStaff.map((a) => (
                      <tr key={a.staff} className="border-t border-gray-100">
                        <td className="px-4 py-2">{a.staff}{a.staff === user?.name ? ' (вы)' : ''}</td>
                        <td>{a.position}</td>
                        <td className="text-right px-4 text-gray-500">{a.in}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2">
              <button onClick={() => navigate('/attendance')} className="h-10 px-4 rounded-md border border-gray-300 hover:bg-gray-100">К явкам</button>
              <button onClick={() => setOnShift(false)} className="h-10 px-5 rounded-md bg-pos-blue text-white">Закрыть</button>
            </div>
          </div>
        </div>
      )}
      {cashModal && <CashMovementModal kind={cashModal} onClose={() => setCashModal(null)} />}
      {openShift && (
        <OpenShiftModal
          onConfirm={(opening) => { openCashShift(opening); setOpenShift(false); printToast(`Кассовая смена открыта · разменный фонд ${opening.toLocaleString('ru-RU')} ₸`) }}
          onCancel={() => setOpenShift(false)}
        />
      )}
    </div>
  )
}
