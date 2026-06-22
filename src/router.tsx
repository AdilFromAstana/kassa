import { createHashRouter } from 'react-router-dom'
import LoginScreen from './screens/LoginScreen'
import MainMenuScreen from './screens/MainMenuScreen'
import PersonalPageScreen from './screens/PersonalPageScreen'
import HallScreen from './screens/HallScreen'
import OrderScreen from './screens/OrderScreen'
import PaymentScreen from './screens/PaymentScreen'
import ShiftCloseScreen from './screens/ShiftCloseScreen'
import ReportsScreen from './screens/ReportsScreen'
import BanquetsScreen from './screens/BanquetsScreen'
import BanquetNewScreen from './screens/BanquetNewScreen'
import ClosedOrdersScreen from './screens/ClosedOrdersScreen'
import CorrectionScreen from './screens/CorrectionScreen'
import StopListScreen from './screens/StopListScreen'
import OpenOrdersScreen from './screens/OpenOrdersScreen'
import FiscalCommandsScreen from './screens/FiscalCommandsScreen'
import FiscalDetailsScreen from './screens/FiscalDetailsScreen'
import ClosedShiftsScreen from './screens/ClosedShiftsScreen'
import AttendanceScreen from './screens/AttendanceScreen'
import MessagesScreen from './screens/MessagesScreen'
import ExtrasScreen from './screens/ExtrasScreen'
import SettingsScreen from './screens/SettingsScreen'
import WarehouseScreen from './screens/WarehouseScreen'
import DocumentsScreen from './screens/DocumentsScreen'
import OfficeScreen from './screens/OfficeScreen'
import EquipmentScreen from './screens/EquipmentScreen'
import KitchenScreen from './screens/KitchenScreen'
import PlatformScreen from './screens/PlatformScreen'
import RegisterScreen from './screens/RegisterScreen'
import OnboardingScreen from './screens/OnboardingScreen'

// HashRouter — чтобы работало как статика (file://) при встраивании в Electron.
export const router = createHashRouter([
  { path: '/', element: <LoginScreen /> },
  { path: '/menu', element: <MainMenuScreen /> },
  { path: '/personal', element: <PersonalPageScreen /> },
  { path: '/halls', element: <HallScreen /> },
  { path: '/order', element: <OrderScreen /> },
  { path: '/payment', element: <PaymentScreen /> },
  { path: '/shift/close', element: <ShiftCloseScreen /> },
  { path: '/reports', element: <ReportsScreen /> },
  { path: '/banquets', element: <BanquetsScreen /> },
  { path: '/banquet/new', element: <BanquetNewScreen /> },
  { path: '/orders/closed', element: <ClosedOrdersScreen /> },
  { path: '/orders/open', element: <OpenOrdersScreen /> },
  { path: '/correction', element: <CorrectionScreen /> },
  { path: '/stoplist', element: <StopListScreen /> },
  { path: '/fiscal/commands', element: <FiscalCommandsScreen /> },
  { path: '/fiscal/details', element: <FiscalDetailsScreen /> },
  { path: '/shifts/closed', element: <ClosedShiftsScreen /> },
  { path: '/attendance', element: <AttendanceScreen /> },
  { path: '/messages', element: <MessagesScreen /> },
  { path: '/extras', element: <ExtrasScreen /> },
  { path: '/settings', element: <SettingsScreen /> },
  { path: '/warehouse', element: <WarehouseScreen /> },
  { path: '/documents', element: <DocumentsScreen /> },
  { path: '/office', element: <OfficeScreen /> }, // бэк-офис (мок): правит конфиг заведения → касса читает
  { path: '/equipment', element: <EquipmentScreen /> }, // Инструменты → Настройка оборудования (локально на терминале)
  { path: '/kitchen', element: <KitchenScreen /> }, // кухонный экран (KDS) — повар видит блюда станций по статусам
  { path: '/platform', element: <PlatformScreen /> }, // SaaS: платформенная админка — реестр клиентов-сетей, онбординг
  { path: '/register', element: <RegisterScreen /> }, // self-serve регистрация новой сети
  { path: '/onboarding', element: <OnboardingScreen /> }, // мастер первого запуска (точка/сотрудник/каталог)
])
