import { defineConfig } from 'vitest/config'

// Тест-раннер для чистой логики (отчёты, склад-движения, деньги). Отдельно от vite.config.ts,
// чтобы не влиять на dev/build приложения. Тест-файлы исключены из tsconfig сборки.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
