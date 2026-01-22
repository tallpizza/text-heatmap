import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
});
