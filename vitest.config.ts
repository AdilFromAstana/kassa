import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Тест-раннер для чистой логики (отчёты, склад-движения, деньги, проводки) и смоук-рендера
// экранов. Отдельно от vite.config.ts, чтобы не влиять на dev/build приложения.
// Окружение по умолчанию — node (быстро); компонентные тесты задают jsdom в шапке файла.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
