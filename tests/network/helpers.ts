import EventSystems from "../../assets/gameframex/event/EventSystems";
import MessageObject from "../../assets/gameframex/network/MessageObject";
import ProtoMessageHelper from "../../assets/gameframex/network/ProtoMessageHelper";
import WebSocketChannel from "../../assets/gameframex/network/WebSocketChannel";
import NetworkModule from "../../assets/gameframex/network/NetworkModule";
import IMessage from "../../assets/gameframex/network/IMessage";
import IRequestMessage from "../../assets/gameframex/network/IRequestMessage";

/**
 * 可控 Mock Socket:记录发送帧与创建顺序,由测试手动触发 open/close/error/message。
 */
export class MockSocket {
    public binaryType = "";
    public sent: ArrayBuffer[] = [];
    public closed = false;
    public onopen: (() => void) | null = null;
    public onclose: (() => void) | null = null;
    public onerror: (() => void) | null = null;
    public onmessage: ((event: { data: unknown }) => void) | null = null;

    public send(data: ArrayBuffer): void {
        this.sent.push(data);
    }

    public close(): void {
        this.closed = true;
    }
}

/** 伪造 protobuf Type:create 直通、encode=JSON、decode=JSON(测试可精确断言 body) */
export function createFakeType(): IMessage {
    return {
        create(payload: unknown): unknown {
            return { ...(payload as Record<string, unknown>) };
        },
        verify(): string | null {
            return null;
        },
        encode(payload: unknown): { finish(): Uint8Array } {
            const body = new TextEncoder().encode(JSON.stringify(payload));
            return { finish: () => body };
        },
        decode(payload: Uint8Array): unknown {
            return JSON.parse(new TextDecoder().decode(payload));
        },
    };
}

/** 测试用请求消息(User.ReqLogin=19660810) */
export class TestReqLogin extends MessageObject implements IRequestMessage {
    public readonly PackageName = "User.ReqLogin";
    public UserName = "cocos";
}

export interface NetworkTestContext {
    module: NetworkModule;
    channel: WebSocketChannel;
    sockets: MockSocket[];
    events: EventSystems;
}

/** 注册 Basic/User 消息 + 伪造 bundle,建立已连接的模块环境 */
export function setupConnectedModule(
    options: { missHeartBeatLimit?: number; rpcTimeoutSeconds?: number; heartBeatInterval?: number } = {},
): NetworkTestContext {
    ProtoMessageHelper.reset();
    ProtoMessageHelper.registerReqMessage("Basic.ReqHeartBeat", 655370);
    ProtoMessageHelper.registerRespMessage("Basic.NotifyHeartBeat", 655371);
    ProtoMessageHelper.registerReqMessage("User.ReqLogin", 19660810);
    ProtoMessageHelper.registerRespMessage("User.RespLogin", 19660811);
    const fakeType = createFakeType();
    ProtoMessageHelper.init({
        Basic: { ReqHeartBeat: fakeType, NotifyHeartBeat: fakeType },
        User: { ReqLogin: fakeType, RespLogin: fakeType },
    });

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
    const module = new NetworkModule({ channel, events, ...options });
    module.connect("127.0.0.1", 8899);
    sockets[0].onopen?.();
    return { module, channel, sockets, events };
}

/** 将一帧二进制经 socket.onmessage 喂给模块(模拟服务器回包) */
export function feedPacket(socket: MockSocket, frame: Uint8Array): void {
    const buffer = new ArrayBuffer(frame.byteLength);
    new Uint8Array(buffer).set(frame);
    socket.onmessage?.({ data: buffer });
}
