# GameFrameX.CocosCreator

GameFrameX 的 Cocos Creator 3.8.x 客户端,以 [Unity 版](../Unity) 为基准从零迁移。

## 架构契约

- 分包结构与 Unity `com.gameframex.unity.*` 一一对应(`assets/gameframex/`),`GameApp.*` 静态门面与 Unity 同名。
- 启动链路与 Unity 版同名同序(11 步 Procedure FSM)。
- 网络协议字节级兼容:12 字节头 + protobuf body,与 Unity 客户端同服互通。
- UIForm 生命周期与 Unity 同名同参;UI 主轨为 Cocos 原生 UI(FormHelper 后端模式隔离)。
- 配置由 luban 生成 JSON + TS 加载。

## 工具链

```bash
npm run gen:proto    # 生成 protobuf TS 消息(61 个)+ 静态 bundle
npm run gen:config   # 生成 luban 配置 JSON
npm test             # 引擎无关核心单测(vitest)
```

## 打开工程

使用 Cocos Creator 3.8.x 打开本目录(首次打开会生成 `library/`、`temp/` 等目录)。

## License

[MIT](./LICENSE)
