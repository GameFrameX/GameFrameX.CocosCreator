import { describe, expect, it, vi } from "vitest";
import EventSystems from "../../assets/gameframex/event/EventSystems";
import EventName from "../../assets/gameframex/event/EventName";
import WebSocketChannel from "../../assets/gameframex/network/WebSocketChannel";
import { NetworkSatus } from "../../assets/gameframex/network/NetworkSatus";
import PackageCodec, { DecodedPacket } from "../../assets/gameframex/network/PackageCodec";
import { MockSocket } from "./helpers";

/** 建立使用 MockSocket 工厂的通道与事件池 */
function createChannel(): { channel: WebSocketChannel; sockets: MockSocket[]; events: EventSystems } {
    const sockets: MockSocket[] = [];
    const events = new EventSystems();
    const channel = new WebSocketChannel({
        events,
        socketFactory: (): MockSocket => {
            const socket = new MockSocket();
            sockets.push(socket);
            return socket;
        },
    });
    return { channel, sockets, events };
}

function toBuffer(packet: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(packet.byteLength);
    new Uint8Array(buffer).set(packet);
    return buffer;
}

/** 打开连接的快捷路径 */
function openChannel(sockets: MockSocket[]): MockSocket {
    sockets[sockets.length - 1].onopen?.();
    return sockets[sockets.length - 1];
}

describe("WebSocketChannel(状态机 + 发送队列 + 自动重连)", () => {
    it("connect 进入 CONNECTING 并以 ws://host:port 创建 socket,设置 binaryType=arraybuffer", () => {
        const { channel, sockets } = createChannel();
        channel.connect("127.0.0.1", 8899);
        expect(channel.status).toBe(NetworkSatus.STATUS_CONNECTING);
        expect(sockets.length).toBe(1);
        expect(sockets[0].binaryType).toBe("arraybuffer");
    });

    it("open 后进入 COMMUNICATION 并派发 SocketConnected", () => {
        const { channel, sockets, events } = createChannel();
        const onConnected = vi.fn();
        events.on(EventName.SocketConnected, onConnected);
        channel.connect("127.0.0.1", 8899);
        sockets[0].onopen?.();
        expect(channel.status).toBe(NetworkSatus.STATUS_COMMUNICATION);
        expect(channel.isConnected).toBe(true);
        expect(onConnected).toHaveBeenCalledTimes(1);
    });

    it("未连接时发送入队,连接建立后按原顺序 flush", () => {
        const { channel, sockets } = createChannel();
        channel.connect("127.0.0.1", 8899);
        const first = new Uint8Array([1]).buffer;
        const second = new Uint8Array([2]).buffer;
        channel.send(first);
        channel.send(second);
        expect(sockets[0].sent.length).toBe(0);
        sockets[0].onopen?.();
        expect(sockets[0].sent.length).toBe(2);
        expect(new Uint8Array(sockets[0].sent[0])[0]).toBe(1);
        expect(new Uint8Array(sockets[0].sent[1])[0]).toBe(2);
    });

    it("已连接时直发不排队", () => {
        const { channel, sockets } = createChannel();
        channel.connect("127.0.0.1", 8899);
        openChannel(sockets);
        channel.send(new Uint8Array([9]).buffer);
        expect(sockets[0].sent.length).toBe(1);
    });

    it("异常断开:派发 SocketClose,update 推进 2s 后自动重连,重连成功派发 SocketReconnect", () => {
        const { channel, sockets, events } = createChannel();
        const onClose = vi.fn();
        const onReconnect = vi.fn();
        events.on(EventName.SocketClose, onClose);
        events.on(EventName.SocketReconnect, onReconnect);
        channel.connect("127.0.0.1", 8899);
        openChannel(sockets);
        sockets[0].onclose?.();
        expect(channel.status).toBe(NetworkSatus.STATUS_DISCONNECT);
        expect(onClose).toHaveBeenCalledTimes(1);

        channel.update(1.9);
        expect(sockets.length).toBe(1); // 未到 2s 间隔,不发起重连
        channel.update(0.1);
        expect(sockets.length).toBe(2); // 重连创建了新 socket
        expect(channel.status).toBe(NetworkSatus.STATUS_CONNECTING);
        expect(onReconnect).not.toHaveBeenCalled();

        openChannel(sockets);
        expect(onReconnect).toHaveBeenCalledTimes(1);
        expect(channel.status).toBe(NetworkSatus.STATUS_COMMUNICATION);
    });

    it("重连成功后重置计数:第二次断开仍可自动重连", () => {
        const { channel, sockets } = createChannel();
        channel.connect("127.0.0.1", 8899);
        openChannel(sockets);
        sockets[0].onclose?.();
        channel.update(2);
        openChannel(sockets); // 第一次重连成功 → 计数重置
        sockets[1].onclose?.();
        channel.update(2);
        expect(sockets.length).toBe(3); // 第二次断开仍发起重连
    });

    it("重连上限 2 次:超限后不再创建新 socket", () => {
        const { channel, sockets } = createChannel();
        channel.connect("127.0.0.1", 8899);
        openChannel(sockets);
        // 连接失败循环:断开 → 重连(socket 创建但从未 open)→ 再断开
        sockets[0].onclose?.();
        channel.update(2);
        sockets[1].onclose?.(); // 重连尝试 1 失败
        channel.update(2);
        sockets[2].onclose?.(); // 重连尝试 2 失败
        channel.update(2);
        channel.update(10);
        expect(sockets.length).toBe(3); // 初始 1 + 重连 2,不再有第 3 次
        expect(channel.status).toBe(NetworkSatus.STATUS_DISCONNECT);
    });

    it("onerror 派发 SocketError 且只调度一次重连(后续 onclose 不重复计时)", () => {
        const { channel, sockets, events } = createChannel();
        const onError = vi.fn();
        const onClose = vi.fn();
        events.on(EventName.SocketError, onError);
        events.on(EventName.SocketClose, onClose);
        channel.connect("127.0.0.1", 8899);
        openChannel(sockets);
        sockets[0].onerror?.();
        sockets[0].onclose?.();
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
        channel.update(2);
        expect(sockets.length).toBe(2); // 只有一轮重连
    });

    it("主动 close:派发 SocketClose 一次、清空发送队列且不触发自动重连", () => {
        const { channel, sockets, events } = createChannel();
        const onClose = vi.fn();
        events.on(EventName.SocketClose, onClose);
        channel.connect("127.0.0.1", 8899);
        openChannel(sockets);
        channel.send(new Uint8Array([1]).buffer);
        channel.close();
        expect(channel.status).toBe(NetworkSatus.STATUS_DISCONNECT);
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(sockets[0].closed).toBe(true);

        channel.update(10);
        expect(sockets.length).toBe(1); // 不重连

        // 手动关闭后可再次 connect(新会话)
        channel.connect("127.0.0.1", 8899);
        openChannel(sockets);
        expect(channel.status).toBe(NetworkSatus.STATUS_COMMUNICATION);
        expect(sockets[1].sent.length).toBe(0); // 关闭时队列已清空
    });

    it("DISCONNECT 状态下重复 close 不重复派发事件", () => {
        const { channel, events } = createChannel();
        const onClose = vi.fn();
        events.on(EventName.SocketClose, onClose);
        channel.close();
        channel.close();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("粘包/半包:onmessage 数据经解码器切帧后逐帧回调 onPacket", () => {
        const { channel, sockets } = createChannel();
        const frames: DecodedPacket[] = [];
        channel.onPacket = (frame: DecodedPacket): void => {
            frames.push(frame);
        };
        channel.connect("127.0.0.1", 8899);
        openChannel(sockets);

        const packet1 = PackageCodec.encode(1, 100, new Uint8Array([0x0a]));
        const packet2 = PackageCodec.encode(2, 200, new Uint8Array([0x0b]));
        const merged = new Uint8Array(packet1.length + packet2.length);
        merged.set(packet1, 0);
        merged.set(packet2, packet1.length);
        // 一次推送 1.5 帧 + 半帧 → 先切出 1 帧
        sockets[0].onmessage?.({ data: toBuffer(merged.slice(0, packet1.length + 7)) });
        expect(frames.length).toBe(1);
        expect(frames[0].uniqueId).toBe(1);
        sockets[0].onmessage?.({ data: toBuffer(merged.slice(packet1.length + 7)) });
        expect(frames.length).toBe(2);
        expect(frames[1].uniqueId).toBe(2);
    });

    it("非二进制消息被忽略不抛错", () => {
        const { channel, sockets } = createChannel();
        channel.onPacket = (): void => {
            throw new Error("不应收到帧");
        };
        channel.connect("127.0.0.1", 8899);
        openChannel(sockets);
        expect(() => sockets[0].onmessage?.({ data: "text-frame" })).not.toThrow();
    });
});
