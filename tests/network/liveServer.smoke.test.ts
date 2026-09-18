import { describe, expect, it } from "vitest";
import $root from "../../assets/gameframex/protobuf/proto-bundle";

/**
 * 真服务器全链路冒烟(env 门控,默认跳过;需 docker gfx-game + gfx-ws-forward 运行):
 * `GFX_LIVE_SMOKE=1 npm test` 或 `npm run smoke:live`
 * 覆盖:WS 握手 → 14 字节头 ReqLogin → RespLogin(uniqueId 配对 + messageId 19660811)→ protobuf 解码。
 */
const liveEnabled = process.env.GFX_LIVE_SMOKE === "1";
const describeLive = liveEnabled ? describe : describe.skip;

const HeaderLength = 14;
const ReqLoginId = 19660810;
const RespLoginId = 19660811;

describeLive("WebSocket 真服务器冒烟(Phase 0-b / Phase 2 验收)", () => {
    it(
        "连 ws://127.0.0.1:39110 发 ReqLogin 收到 RespLogin 并解码",
        async () => {
            const type = $root.User.ReqLogin;
            const body = type.encode(type.create({ UserName: "cocos-smoke", Platform: "cocos", SdkType: 0, SdkToken: "", Device: "vitest" })).finish();

            const totalLength = HeaderLength + body.length;
            const frame = new Uint8Array(totalLength);
            const view = new DataView(frame.buffer);
            view.setUint32(0, totalLength, false);
            frame[4] = 4; // operationType:普通
            frame[5] = 0; // zipFlag
            view.setInt32(6, 1, false); // uniqueId
            view.setInt32(10, ReqLoginId, false);
            frame.set(body, HeaderLength);

            const ws = new WebSocket("ws://127.0.0.1:39110");
            ws.binaryType = "arraybuffer";

            const received = await new Promise<{ messageId: number; body: Uint8Array }>((resolve, reject) => {
                // 真实网络集成测试:无法用假时钟;此 setTimeout 仅作失败截止线,成功路径由 onmessage 事件驱动
                const timer = setTimeout(() => reject(new Error("15s 未收到回包")), 15000);
                ws.onmessage = (event) => {
                    clearTimeout(timer);
                    const data = new Uint8Array(event.data);
                    const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
                    resolve({ messageId: v.getInt32(10, false), body: data.subarray(HeaderLength) });
                };
                ws.onerror = () => reject(new Error("WS 连接失败(服务器或转发容器未运行?)"));
                ws.onopen = () => ws.send(frame);
            });
            ws.close();
            // 真实网络集成测试:无法用假时钟;此 setTimeout 仅作失败截止线,成功路径由 onmessage 事件驱动
            expect(received.messageId).toBe(RespLoginId);
            const resp = $root.User.RespLogin.decode(received.body);
            expect(resp).toBeDefined();
        },
        20000
    );
});
