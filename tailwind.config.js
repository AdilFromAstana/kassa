/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // палитра iikoFront-подобной кассы
        pos: {
          bg: '#2b2b2b',        // тёмный фон рабочей области
          panel: '#f4f4f4',     // светлая панель заказа
          accent: '#d9e021',    // жёлто-зелёный (выбранная позиция/активная вкладка)
          accentDark: '#b8c400',
          blue: '#3a6ea5',      // плитки групп меню
          blueDark: '#2f5984',
          rose: '#f3c6c6',      // просрочка/предупреждение
          green: '#5aa469',     // оплачено/доступно
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', 'Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
