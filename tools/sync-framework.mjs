#!/usr/bin/env node
/**
 * 框架同步 CLI(与编辑器菜单"GameFrameX/同步框架到项目"等价;供 CI/无编辑器环境使用)。
 * 用法:node tools/sync-framework.mjs
 */
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const projectRoot = resolve(new URL("..", import.meta.url).pathname);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { syncFramework } = require("../extensions/com.gameframex.framework/src/sync.js");

const result = syncFramework(projectRoot);
console.log(`[sync-framework] 版本 ${result.version}:新增 ${result.added} / 更新 ${result.updated} / 移除 ${result.removed}(共 ${result.total} 文件 → assets/gameframex)`);
