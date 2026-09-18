#!/bin/bash
# 生成 protobufjs 静态 bundle(pbjs static-module,小游戏主路线,无运行时 .load)。
# - --keep-case:保持 .proto 原始 PascalCase 字段名,与 ProtoExport 生成的 TS 类字段一致
# - 排除 Inner_*:服务器内部协议,客户端不需要
# - 三环境(Node/vite/Cocos 构建)统一:es6 wrapper + 相对路径 vendor protobufjs/minimal,
#   import 改 default 形式(Node/vite 的 CJS interop 下 $protobuf.roots 可用)

set -e

cd "$(dirname "$0")/.."

RUNTIME_DIR=extensions/com.gameframex.framework/runtime/gameframex

# 1) vendor protobufjs minimal 运行时(UMD 体包进 .ts:裸 .js 会被 Cocos 构建套 modLo 的 CJS 虚拟包装,
#    该机制在微信小游戏运行时挂死;统一走 TS 管线彻底绕开)
{
    echo '// @ts-nocheck'
    echo '// 生成物:protobufjs dist/minimal UMD 的 TS 包装(tools/gen-proto-bundle.sh);禁止手改'
    echo 'const __gfxModule = { exports: {} };'
    echo '(function (module, exports) {'
    cat node_modules/protobufjs/dist/minimal/protobuf.min.js
    echo '})(__gfxModule, __gfxModule.exports);'
    echo 'export default __gfxModule.exports;'
} > "$RUNTIME_DIR/protobuf/protobufjs-minimal.ts"

# 2) 生成静态 bundle
npx pbjs -t static-module -w es6 --keep-case \
    -o "$RUNTIME_DIR/protobuf/proto-bundle.ts" \
    ../Protobuf/_0010_Basic.proto \
    ../Protobuf/_0020_Common.proto \
    ../Protobuf/_0100_Bag.proto \
    ../Protobuf/_0120_Social.proto \
    ../Protobuf/_0300_User.proto \
    ../Protobuf/_0310_Attribute.proto \
    ../Protobuf/_0400_Room.proto \
    ../Protobuf/_0410_RockPaperScissors.proto \
    ../Protobuf/_0500_Mail.proto

# 3) 相对路径 + default 导入(裸说明符在 Cocos 构建/Node ESM 均不可解析)
# .ts 走 TS 管线(避免 .js 含 ESM 语法被 modLo 当 CJS 包装的 3.8 已知坑);@ts-nocheck 免生成代码严格检查
sed -i '' 's|import \* as \$protobuf from "protobufjs/minimal";|import $protobuf from "./protobufjs-minimal";|' "$RUNTIME_DIR/protobuf/proto-bundle.ts"
printf '// @ts-nocheck\n// 生成物:pbjs static-module(tools/gen-proto-bundle.sh);禁止手改\n%s\n' "$(cat "$RUNTIME_DIR/protobuf/proto-bundle.ts")" > "$RUNTIME_DIR/protobuf/proto-bundle.ts.tmp" && mv "$RUNTIME_DIR/protobuf/proto-bundle.ts.tmp" "$RUNTIME_DIR/protobuf/proto-bundle.ts"

echo "proto-bundle.ts + protobufjs-minimal.ts 生成完成"
