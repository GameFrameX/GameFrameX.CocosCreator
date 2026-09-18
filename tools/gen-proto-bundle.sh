#!/bin/bash
# 生成 protobufjs 静态 bundle(pbjs static-module,小游戏主路线,无运行时 .load)。
# --keep-case:保持 .proto 原始 PascalCase 字段名,与 ProtoExport 生成的 TS 类字段一致。
# 排除 Inner_*:服务器内部协议,客户端不需要。

set -e

cd "$(dirname "$0")/.."

npx pbjs -t static-module -w commonjs --keep-case \
    -o extensions/com.gameframex.framework/runtime/gameframex/protobuf/proto-bundle.js \
    ../Protobuf/_0010_Basic.proto \
    ../Protobuf/_0020_Common.proto \
    ../Protobuf/_0100_Bag.proto \
    ../Protobuf/_0120_Social.proto \
    ../Protobuf/_0300_User.proto \
    ../Protobuf/_0310_Attribute.proto \
    ../Protobuf/_0400_Room.proto \
    ../Protobuf/_0410_RockPaperScissors.proto \
    ../Protobuf/_0500_Mail.proto

# Node ESM 解析要求显式 .js 后缀(protobufjs 7.x exports map 未含 ESM 子路径)
sed -i '' 's|from "protobufjs/minimal"|from "protobufjs/minimal.js"|' extensions/com.gameframex.framework/runtime/gameframex/protobuf/proto-bundle.js

echo "proto-bundle.js 生成完成"
