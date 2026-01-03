import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./playwrite",
  timeout: 30000,
  fullyParallel: false, // 顺序执行，避免数据库冲突
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // 单线程执行测试
  reporter: "html",
  use: {
    baseURL: process.env.API_URL || "http://localhost:3000",
    trace: "on-first-retry",
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
