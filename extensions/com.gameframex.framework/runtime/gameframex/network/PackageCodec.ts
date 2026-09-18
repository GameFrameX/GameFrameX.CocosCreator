import Log from "../base/Log";

/**
 * 14 字节网络包头(全大端;与服务器/Unity 字节级对齐,详见 notes-Network.md):
 *
 * | 偏移 | 长度 | 字段          | 语义 |
 * |------|------|---------------|------|
 * | 0    | 4    | totalLength   | uint32 包总长(含本 14 字节头 + body) |
 * | 4    | 1    | operationType | 发送侧:普通=4、心跳=1;服务器回包实测可为 0,解包侧不校验 |
 * | 5    | 1    | zipFlag       | 0=未压缩;1=已压缩(服务器阈值 512,客户端暂未实现解压) |
 * | 6    | 4    | uniqueId      | int32 请求唯一编号(RPC 配对;超过 int31 按位回绕) |
 * | 10   | 4    | messageId     | int32 消息号 (module<<16)+id |
 *
 * 权威依据:Server.Source/GameFrameX.NetWork.Message/DefaultMessageEncoderHandler.cs、
 * Unity com.gameframex.unity.network DefaultPacketSendHeaderHandler/DefaultPacketReceiveHeaderHandler。
 */
export interface PacketHeader {
    /** 包总长(含头) */
    packetLength: number;
    /** 操作类型(解包侧不校验) */
    operationType: number;
    /** 压缩标记 */
    zipFlag: number;
    /** 请求唯一编号(int32 有符号语义) */
    uniqueId: number;
    /** 消息号 (module<<16)+id */
    messageId: number;
}

/** 一条完整解出的网络帧:头 + body */
export interface DecodedPacket extends PacketHeader {
    body: Uint8Array;
}

export default class PackageCodec {
    /** 包头长度:uint32 + byte + byte + int32 + int32 = 14 */
    public static readonly HEADER_LENGTH = 14;

    /** 普通业务消息操作类型(服务器 MessageOperationType.Game) */
    public static readonly OPERATION_TYPE_GAME = 4;

    /** 心跳消息操作类型(服务器 MessageOperationType.HeartBeat) */
    public static readonly OPERATION_TYPE_HEART_BEAT = 1;

    /**
     * 封包:写入 14 字节大端头 + body。
     * 契约:packetLength = 14 + body.length(含头总长);operationType 发送侧取 4(普通)/1(心跳)。
     */
    public static encode(
        uniqueId: number,
        messageId: number,
        body: Uint8Array,
        operationType: number = PackageCodec.OPERATION_TYPE_GAME,
        zipFlag: number = 0,
    ): Uint8Array {
        const packet = new Uint8Array(PackageCodec.HEADER_LENGTH + body.length);
        const view = new DataView(packet.buffer);
        view.setUint32(0, packet.length, false);
        view.setUint8(4, operationType);
        view.setUint8(5, zipFlag);
        view.setInt32(6, uniqueId, false);
        view.setInt32(10, messageId, false);
        packet.set(body, PackageCodec.HEADER_LENGTH);
        return packet;
    }

    /**
     * 解析包头(不解 body)。字节数不足 14(半包)返回 null,由调用方继续等待。
     */
    public static readHeader(source: Uint8Array): PacketHeader | null {
        if (source.length < PackageCodec.HEADER_LENGTH) {
            return null;
        }
        const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
        return {
            packetLength: view.getUint32(0, false),
            operationType: view.getUint8(4),
            zipFlag: view.getUint8(5),
            uniqueId: view.getInt32(6, false),
            messageId: view.getInt32(10, false),
        };
    }
}

/**
 * 流式解包器:处理 TCP/WebSocket 字节流的粘包与半包。
 *
 * 契约:push 追加任意长度分片;drain 按包头 uint32 totalLength(含头)切帧,
 * 返回本次可切出的全部完整帧;不足一帧的字节保留在内部缓冲区等待后续分片。
 */
export class PackageDecoder {
    private _buffer: Uint8Array = new Uint8Array(0);

    /**
     * 追加一段字节分片(ArrayBuffer)。
     */
    public push(chunk: ArrayBuffer): void {
        const merged = new Uint8Array(this._buffer.length + chunk.byteLength);
        merged.set(this._buffer, 0);
        merged.set(new Uint8Array(chunk), this._buffer.length);
        this._buffer = merged;
    }

    /**
     * 切出缓冲区中当前所有完整帧;body 为原帧 [14, totalLength) 区间的拷贝。
     * 非法帧(totalLength < 头长)直接告警丢弃,避免死循环卡死流。
     */
    public drain(): DecodedPacket[] {
        const packets: DecodedPacket[] = [];
        while (this._buffer.length >= PackageCodec.HEADER_LENGTH) {
            const header = PackageCodec.readHeader(this._buffer);
            if (header === null) {
                break;
            }
            if (header.packetLength < PackageCodec.HEADER_LENGTH) {
                Log.error(
                    "PackageCodec",
                    `非法帧长 ${header.packetLength}(小于头长 14),丢弃缓冲区 ${this._buffer.length} 字节`,
                );
                this._buffer = new Uint8Array(0);
                break;
            }
            if (header.packetLength > this._buffer.length) {
                break; // 半包:等待更多分片
            }
            const body = this._buffer.slice(PackageCodec.HEADER_LENGTH, header.packetLength);
            this._buffer = this._buffer.slice(header.packetLength);
            packets.push({ ...header, body });
        }
        return packets;
    }

    /**
     * 清空缓冲区(通道重置/测试隔离用)。
     */
    public clear(): void {
        this._buffer = new Uint8Array(0);
    }
}
