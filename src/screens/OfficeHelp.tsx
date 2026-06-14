import { BookOpen, Keyboard, Info, LifeBuoy } from 'lucide-react'
import { usePos } from '../store/pos'

// Помощь (раздел 16) — справка, горячие клавиши, о системе, поддержка. Статично (мок).
export default function OfficeHelp() {
  const est = usePos((s) => s.establishment)
  return (
    <div className="p-6 max-w-3xl space-y-4">
      <div className="text-xs text-gray-500">Справочный раздел (16). Документация iiko, горячие клавиши, сведения о системе и поддержка.</div>

      <Card icon={<BookOpen size={16} />} title="Документация">
        <ul className="list-disc pl-5 space-y-1">
          <li>Бизнес-процессы и экраны — по разделам меню слева (01–16 офис, касса iikoFront).</li>
          <li>Учёт по Казахстану: тенге ₸, ҚҚС 16%, БИН/ИИН, Webkassa/ОФД РК, ЭСФ/СНТ, 1С:Бухгалтерия для РК.</li>
          <li>Двойная бухгалтерия — план счетов РК (раздел «Финансы → Бухучёт»).</li>
        </ul>
      </Card>

      <Card icon={<Keyboard size={16} />} title="Горячие клавиши (касса)">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
          <Row k="Открыть смену" v="на главном экране кассы" />
          <Row k="Быстрый чек" v="нижняя панель → Быстрый чек" />
          <Row k="Оплата" v="в заказе → КАССА" />
          <Row k="Стоп-лист" v="Сервис → Стоп-лист" />
        </div>
      </Card>

      <Card icon={<Info size={16} />} title="О системе">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
          <Row k="Продукт" v="iiko (мок): iikoOffice + iikoFront" />
          <Row k="Заведение" v={est.name} />
          <Row k="Режим" v={est.mode === 'restaurant' ? 'Ресторан' : 'Фастфуд'} />
          <Row k="Регион" v="Казахстан (РК)" />
          <Row k="Версия" v="0.1 (демо на моках)" />
          <Row k="Бэкенд" v=".NET — в планах" />
        </div>
      </Card>

      <Card icon={<LifeBuoy size={16} />} title="Поддержка">
        <div className="text-gray-600">Техподдержка iiko Казахстан · документация ru.iiko.help · ИС ЭСФ esf.gov.kz · КГД kgd.gov.kz. (Контакты — на бэкенде.)</div>
      </Card>
    </div>
  )
}

const Card = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="bg-white border border-gray-200 rounded-md p-4">
    <div className="flex items-center gap-2 text-gray-700 font-medium mb-2">{icon}{title}</div>
    <div className="text-sm text-gray-600">{children}</div>
  </div>
)
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between py-0.5 text-sm"><span className="text-gray-500">{k}</span><span className="text-gray-800">{v}</span></div>
)
