#!/usr/bin/env node
/**
 * 构建主包体积报告(R6:微信小游戏主包 ≤ 4MB;远程 Bundle 分流后不占主包)。
 * 用法:node tools/size-report.mjs [构建目录,默认 build/wechatgame]
 */
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = resolve(process.argv[2] ?? "build/wechatgame");
const LIMIT_MB = 4;

function walk(node, acc) {
    for (const name of readdirSync(node)) {
        const full = join(node, name);
        const st = statSync(full);
        if (st.isDirectory()) {
            walk(full, acc);
        } else {
            acc.push({ path: full.slice(dir.length + 1), bytes: st.size });
        }
    }
    return acc;
}

const files = walk(dir, []);
const total = files.reduce((sum, f) => sum + f.bytes, 0);

/** 小游戏"主包"=除分包目录(assets/<bundle> 与 game.json 声明外)外的全部文件 */
const bundleDirs = new Set(
    readdirSync(join(dir, "assets"), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => `assets/${e.name}`)
);
const mainFiles = files.filter((f) => !([...bundleDirs].some((b) => f.path.startsWith(b + "/"))));
const mainBundle = mainFiles.reduce((sum, f) => sum + f.bytes, 0);

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2);
console.log(`[size-report] ${dir}`);
console.log(`  总体积: ${mb(total)} MB / 文件 ${files.length} 个`);
for (const b of bundleDirs) {
    const size = files.filter((f) => f.path.startsWith(b + "/")).reduce((s, f) => s + f.bytes, 0);
    console.log(`  分包 ${b}: ${mb(size)} MB`);
}
console.log(`  主包(不含分包): ${mb(mainBundle)} MB / 限额 ${LIMIT_MB} MB → ${mainBundle <= LIMIT_MB * 1024 * 1024 ? "达标 ✅" : "超限 ❌"}`);
const top = [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 5);
console.log("  Top5 文件:");
for (const f of top) {
    console.log(`    ${mb(f.bytes).padStart(8)} MB  ${f.path}`);
}
process.exit(mainBundle <= LIMIT_MB * 1024 * 1024 ? 0 : 2);
