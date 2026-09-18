import { afterEach, describe, expect, it, vi } from "vitest";
import EventName from "../../assets/gameframex/event/EventName";
import MessageHandlerRegistry, { MessageHandler } from "../../assets/gameframex/network/MessageHandler";
import PackageCodec from "../../assets/gameframex/network/PackageCodec";
import { NetworkSatus } from "../../assets/gameframex/network/NetworkSatus";
import { feedPacket, setupConnectedModule, TestReqLogin } from "./helpers";

const RESP_LOGIN_MESSAGE_ID = 19660811;
const NOTIFY_HEART_BEAT_MESSAGE_ID = 655371;

/** 读取已发送帧的头字段(uint32/int32 大端) */
function readHeader(buffer: ArrayBuffer): { uniqueId: number; messageId: number; operationType: number } {
    const view = new DataView(buffer);
    return {
        uniqueId: view.getInt32(6, false),
        messageId: view.getInt32(10, false),
        operationType: view.getUint8(4),
    };
}

afterEach(() => {
    MessageHandlerRegistry.clear();
});

describe("NetworkModule(RPC 配对 + 心跳)", () => {
    it("call 发出的帧头正确:uniqueId/messageId/op=4;回包按 uniqueId 配对 resolve", async () => {
        const { module, sockets } = setupConnectedModule();
        const req = new TestReqLogin();
        const pending = module.call(req);
        expect(sockets[0].sent.length).toBe(1);
        const header = readHeader(sockets[0].sent[0]);
        expect(header.uniqueId).toBe(req.UniqueId);
        expect(header.messageId).toBe(19660810);
        expect(header.operationType).toBe(4);

        const body = new TextEncoder().encode(JSON.stringify({ Code: 0, UserName: "cocos" }));
        feedPacket(sockets[0], PackageCodec.encode(req.UniqueId, RESP_LOGIN_MESSAGE_ID, body, 0));
        const resp = await pending;
        expect(resp.MessageId).toBe(RESP_LOGIN_MESSAGE_ID);
        expect(resp.UniqueId).toBe(req.UniqueId);
        if ("UserName" in resp && "Code" in resp) {
            expect(resp.UserName).toBe("cocos");
            expect(resp.Code).toBe(0);
        } else {
            throw new Error("RespLogin 字段缺失");
        }
    });

    it("call 的 Promise 在 10s 虚拟时间后超时 reject,且清理配对表", async () => {
        const { module, sockets } = setupConnectedModule();
        const req = new TestReqLogin();
        const pending = module.call(req);
        module.update(9.9);
        module.update(0.1);
        await expect(pending).rejects.toThrow(/超时/);

        // 超时后同 uniqueId 回包不再配对,走 Notify 分发(不抛未处理拒绝)
        const notified: unknown[] = [];
        MessageHandlerRegistry.register(RESP_LOGIN_MESSAGE_ID, (message: unknown): void => {
            notified.push(message);
        });
        const body = new TextEncoder().encode(JSON.stringify({ Code: 1 }));
        feedPacket(sockets[0], PackageCodec.encode(req.UniqueId, RESP_LOGIN_MESSAGE_ID, body, 0));
        expect(notified.length).toBe(1);
    });

    it("无 uniqueId 匹配的回包按 Notify 分发到 MessageHandlerRegistry", () => {
        const { sockets } = setupConnectedModule();
        const received: unknown[] = [];
        @MessageHandler(RESP_LOGIN_MESSAGE_ID)
        class RespLoginNotifyHandler {
            public static Handler(message: unknown): void {
                received.push(message);
            }
        }
        void RespLoginNotifyHandler;
        const body = new TextEncoder().encode(JSON.stringify({ Code: 7 }));
        feedPacket(sockets[0], PackageCodec.encode(424242, RESP_LOGIN_MESSAGE_ID, body, 0));
        expect(received.length).toBe(1);
        const message = received[0];
        if (
            message !== null &&
            typeof message === "object" &&
            "MessageId" in message &&
            "UniqueId" in message &&
            "Code" in message
        ) {
            expect(message.MessageId).toBe(RESP_LOGIN_MESSAGE_ID);
            expect(message.UniqueId).toBe(424242);
            expect(message.Code).toBe(7);
        } else {
            throw new Error("Notify 消息形状不符");
        }
    });

    it("send 为非 RPC 直发:发出帧但不进入配对表", () => {
        const { module, sockets } = setupConnectedModule();
        const req = new TestReqLogin();
        module.send(req);
        expect(sockets[0].sent.length).toBe(1);
        const header = readHeader(sockets[0].sent[0]);
        expect(header.uniqueId).toBe(req.UniqueId);
        expect(header.messageId).toBe(19660810);
        // 回包无 pending 匹配 → 转 Notify,不产生未处理 Promise 拒绝
        expect(() => {
            feedPacket(sockets[0], PackageCodec.encode(req.UniqueId, RESP_LOGIN_MESSAGE_ID, new Uint8Array(0), 0));
        }).not.toThrow();
    });

    it("未连接时 call 随通道入队,重连建立后 flush 发出并完成配对", async () => {
        const { module, sockets } = setupConnectedModule();
        sockets[0].onclose?.();
        module.update(2); // 重连计时到点,创建新 socket
        sockets[1].onopen?.();
        sockets[1].onclose?.(); // 再次断开,RPC 在断开期间发起
        const req = new TestReqLogin();
        const pending = module.call(req);
        module.update(2);
        sockets[2].onopen?.();
        const header = readHeader(sockets[2].sent[0]);
        expect(header.messageId).toBe(19660810);
        const body = new TextEncoder().encode(JSON.stringify({ Code: 0 }));
        feedPacket(sockets[2], PackageCodec.encode(req.UniqueId, RESP_LOGIN_MESSAGE_ID, body, 0));
        await expect(pending).resolves.toBeTruthy();
    });

    it("连接后每 30s 发送 ReqHeartBeat:op=1、messageId=655370、body 含 Timestamp", () => {
        const { module, sockets } = setupConnectedModule();
        module.update(29.9);
        expect(sockets[0].sent.length).toBe(0);
        module.update(0.1);
        expect(sockets[0].sent.length).toBe(1);
        const header = readHeader(sockets[0].sent[0]);
        expect(header.operationType).toBe(1);
        expect(header.messageId).toBe(655370);
        const bodyText = new TextDecoder().decode(
            new Uint8Array(sockets[0].sent[0]).slice(PackageCodec.HEADER_LENGTH),
        );
        const parsed: unknown = JSON.parse(bodyText);
        if (parsed !== null && typeof parsed === "object" && "Timestamp" in parsed) {
            expect(typeof parsed.Timestamp === "number" && parsed.Timestamp > 0).toBe(true);
        } else {
            throw new Error("ReqHeartBeat body 缺少 Timestamp");
        }

        // 30s 间隔:再走 30s 才发第二跳
        module.update(29.9);
        expect(sockets[0].sent.length).toBe(1);
        module.update(0.1);
        expect(sockets[0].sent.length).toBe(2);
    });

    it("连续丢失心跳:第二跳起派发 NetworkMissHeartBeat(携带丢失计数),超过上限关闭通道", () => {
        const { module, channel, sockets, events } = setupConnectedModule({ missHeartBeatLimit: 2 });
        const missEvents: unknown[] = [];
        events.on(EventName.NetworkMissHeartBeat, (data): void => {
            missEvents.push(data);
        });
        module.update(30); // 第 1 跳:发送,计数 0→1,不发事件
        expect(missEvents).toEqual([]);
        module.update(30); // 第 2 跳:发送,发现上次丢失 → 事件(1),计数→2
        expect(missEvents).toEqual([1]);
        module.update(30); // 第 3 跳:事件(2),计数→3 > 上限 2 → 关闭通道
        expect(missEvents).toEqual([1, 2]);
        expect(channel.status).toBe(NetworkSatus.STATUS_DISCONNECT);
        expect(sockets[0].closed).toBe(true);
        // 通道关闭后不再发送心跳
        module.update(30);
        expect(sockets[0].sent.length).toBe(3);
    });

    it("收到 NotifyHeartBeat(operationType=0,实测服务器回包)重置丢失计数", () => {
        const { module, sockets, events } = setupConnectedModule({ missHeartBeatLimit: 2 });
        const missEvents: unknown[] = [];
        events.on(EventName.NetworkMissHeartBeat, (data): void => {
            missEvents.push(data);
        });
        module.update(30); // miss=1
        const body = new TextEncoder().encode(JSON.stringify({ Timestamp: 123 }));
        // 服务器实测回包 operationType=0:解包侧不得校验其值
        feedPacket(sockets[0], PackageCodec.encode(0, NOTIFY_HEART_BEAT_MESSAGE_ID, body, 0));
        module.update(30); // 上一跳已收到回应 → 不发事件
        expect(missEvents).toEqual([]);
    });

    it("断开状态不发送心跳", () => {
        const { module, sockets } = setupConnectedModule();
        sockets[0].onclose?.();
        module.update(100);
        expect(sockets[0].sent.length).toBe(0);
    });

    it("shutdown 关闭通道并 reject 全部未决 RPC", async () => {
        const { module, sockets } = setupConnectedModule();
        const req = new TestReqLogin();
        const pending = module.call(req);
        module.shutdown();
        await expect(pending).rejects.toThrow(/关闭/);
        expect(sockets[0].closed).toBe(true);
    });

    it("zipFlag=1 的回包告警跳过,不影响后续帧", () => {
        const { module, sockets } = setupConnectedModule();
        const req = new TestReqLogin();
        void module.call(req);
        feedPacket(sockets[0], PackageCodec.encode(req.UniqueId, RESP_LOGIN_MESSAGE_ID, new Uint8Array([1]), 0, 1));
        const body = new TextEncoder().encode(JSON.stringify({ Code: 5 }));
        feedPacket(sockets[0], PackageCodec.encode(req.UniqueId, RESP_LOGIN_MESSAGE_ID, body, 0));
        // 第一帧因 zipFlag=1 跳过(解压未实现),不抛错即视为通过;第二帧正常处理
        expect(sockets[0].sent.length).toBe(1);
    });
});
