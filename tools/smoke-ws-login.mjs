/**
 * 网络冒烟工具(Phase 0-b / Phase 2 证据):Node 环境直连 Server.Source WebSocket,
 * 以 14 字节协议头发 ReqLogin,断言收到 RespLogin(19660811)且 Code 字段可解码。
 *
 * 用法:node tools/smoke-ws-login.mjs [host:port]  (默认 127.0.0.1:39110,即 docker WsPort 29110 转发)
 */
import $root from "../assets/gameframex/protobuf/proto-bundle.js";

const hostPort = process.argv[2] ?? "127.0.0.1:39110";
const ReqLoginId = 19660810; // 300<<16 + 10
const RespLoginId = 19660811;
const HeaderLength = 14;
const OperationTypeNormal = 4;

const type = $root.User.ReqLogin;
const body = type.encode(type.create({ UserName: "cocos-smoke", Platform: "cocos", SdkType: 0, SdkToken: "", Device: "node-smoke" })).finish();

const totalLength = HeaderLength + body.length;
const frame = new Uint8Array(totalLength);
const view = new DataView(frame.buffer);
view.setUint32(0, totalLength, false); // 大端总长(含头)
frame[4] = OperationTypeNormal;
frame[5] = 0; // zipFlag
view.setInt32(6, 1, false); // uniqueId
view.setInt32(10, ReqLoginId, false); // messageId
frame.set(body, HeaderLength);

console.log(`[smoke] 连接 ws://${hostPort} …`);
const ws = new WebSocket(`ws://${hostPort}`);
ws.binaryType = "arraybuffer";
const timeout = setTimeout(() => {
    console.error("[smoke] 超时:15s 内未收到 RespLogin");
    process.exit(1);
}, 15000);

ws.onopen = () => {
    console.log(`[smoke] 已连接,发送 ReqLogin(${body.length}B body,总长 ${totalLength}B)`);
    ws.send(frame);
};
ws.onmessage = (event) => {
    const data = new Uint8Array(event.data);
    const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const total = v.getUint32(0, false);
    const opType = data[4];
    const zipFlag = data[5];
    const uniqueId = v.getInt32(6, false);
    const messageId = v.getInt32(10, false);
    console.log(`[smoke] 收帧:total=${total} opType=${opType} zip=${zipFlag} uniqueId=${uniqueId} messageId=${messageId} body=${data.length - HeaderLength}B`);
    if (messageId === RespLoginId) {
        const resp = $root.User.RespLogin.decode(data.subarray(HeaderLength));
        console.log("[smoke] RespLogin 解码:", JSON.stringify(resp));
        console.log("[smoke] PASS:WebSocket + 14 字节头 + protobuf RPC 全链路通");
        clearTimeout(timeout);
        ws.close();
        process.exit(0);
    }
};
ws.onerror = (event) => {
    console.error("[smoke] WS 错误:", event.message ?? event);
    process.exit(1);
};
ws.onclose = (event) => {
    console.log(`[smoke] 连接关闭 code=${event.code}`);
};
