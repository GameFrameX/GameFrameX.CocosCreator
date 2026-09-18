/** 一次性验证(throwaway):在小游戏运行时内执行真实 WS 登录冒烟 */
import automator from "miniprogram-automator";

const miniProgram = await automator.connect({ wsEndpoint: "ws://localhost:9420" });

// 在小游戏上下文内:手工编码 ReqLogin protobuf → WS 连 Server.Source → 断言 RespLogin(19660811)
const result = await miniProgram.evaluate(() => {
    return new Promise((resolve) => {
        const varint = (n) => { const out = []; n = n >>> 0; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; out.push(b); } while (n); return out; };
        const fieldStr = (tag, s) => { const bytes = []; for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i)); return [...varint(tag << 3 | 2), ...varint(bytes.length), ...bytes]; };
        const body = [...fieldStr(1, "wx-smoke"), ...fieldStr(2, "cocos"), ...varint(24 << 3), ...fieldStr(5, "wechatgame")];
        const H = 14, total = H + body.length;
        const frame = new Uint8Array(total);
        const dv = new DataView(frame.buffer);
        dv.setUint32(0, total, false); frame[4] = 4; frame[5] = 0;
        dv.setInt32(6, 777, false); dv.setInt32(10, 19660810, false);
        frame.set(body, H);
        const ws = new WebSocket("ws://127.0.0.1:39110");
        ws.binaryType = "arraybuffer";
        const timer = setTimeout(() => resolve({ pass: false, stage: "timeout" }), 12000);
        ws.onopen = () => ws.send(frame);
        ws.onerror = (e) => { clearTimeout(timer); resolve({ pass: false, stage: "ws-error", message: String(e && e.message || e) }); };
        ws.onmessage = (ev) => {
            clearTimeout(timer);
            const d = new Uint8Array(ev.data);
            const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
            const msgId = v.getInt32(10, false);
            const uniq = v.getInt32(6, false);
            ws.close();
            resolve({ pass: msgId === 19660811, stage: "received", messageId: msgId, uniqueId: uniq, bodyLen: d.length - H, platform: typeof wx !== "undefined" ? (wx.getSystemInfoSync().platform) : "no-wx" });
        };
    });
});
console.log("=== 小游戏运行时内 WS 登录冒烟 ===");
console.log(JSON.stringify(result, null, 2));
await miniProgram.disconnect();
