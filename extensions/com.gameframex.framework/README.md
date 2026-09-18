# com.gameframex.framework

GameFrameX 框架层扩展(以 Unity 版为基准迁移)。

## 结构

- `runtime/gameframex/` — 框架源码**单一事实源**(含随行 `.meta`,脚本 uuid 跨机器稳定)
- `src/main.js` — 扩展主进程入口(菜单命令)
- `src/sync.js` — 镜像同步逻辑(编辑器与 CLI 共用)

## 菜单

- **GameFrameX / 同步框架到项目**:镜像同步 `runtime/gameframex → assets/gameframex`(新增/更新/删除 + 版本戳)
- **GameFrameX / 移除项目内框架**:删除生成物
- **GameFrameX / 运行单元测试**:执行 `npm test` 并弹窗展示结果

`assets/gameframex/` 为生成物(不入库)。无编辑器环境(如 CI)可用 CLI 等价同步:

```bash
node tools/sync-framework.mjs
```

## 更新流程

改框架代码 → 在 `runtime/gameframex/` 修改(事实源)→ 菜单"同步框架到项目" → `npm test` 回归。
