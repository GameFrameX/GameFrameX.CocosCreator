import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    // 根 tsconfig.json 面向 Cocos 编辑器(extends temp/tsconfig.cocos.json,编辑器首开后生成),
    // Node 测试侧使用独立的编译选项,避免 vite 解析缺失的 extends 链。
    tsconfigRaw: {
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        esModuleInterop: true,
        experimentalDecorators: true,
      },
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
