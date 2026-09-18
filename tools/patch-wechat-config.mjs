#!/usr/bin/env node
/**
 * 微信小游戏构建后修补(每次 Cocos 构建会重新生成 project.config.json,需重打):
 * - libVersion:指定本地已装基础库(避免 "latest" 拉取需开发者权限/无效值导致模拟器 launch error)
 * - urlCheck:false(开发期放行本地 127.0.0.1 联调上报)
 * 用法:node tools/patch-wechat-config.mjs [构建目录,默认 build/wechatgame]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(process.argv[2] ?? "build/wechatgame");
const file = resolve(dir, "project.config.json");
const config = JSON.parse(readFileSync(file, "utf-8"));

config.libVersion = "3.16.2";
config.setting = { ...(config.setting ?? {}), urlCheck: false };

writeFileSync(file, JSON.stringify(config, null, 4));
console.log(`[patch-wechat-config] ${file}: libVersion=${config.libVersion} urlCheck=false`);
