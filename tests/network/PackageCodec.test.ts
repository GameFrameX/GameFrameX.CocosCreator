import { describe, expect, it } from "vitest";
import PackageCodec, { PackageDecoder } from "../../assets/gameframex/network/PackageCodec";

/**
 * 字节级契约(以服务器 DefaultMessageEncoderHandler 为准绳):
 * 14 字节大端头 = uint32 totalLength(含头总长) + byte operationType + byte zipFlag
 *              + int32 uniqueId + int32 messageId;body 紧随其后。
 * 服务器实测:回包 operationType 可能为 0,解包侧不校验其值。
 */

/** Uint8Array → 独立 ArrayBuffer 拷贝(类型上保证非 SharedArrayBuffer) */
function toBuffer(packet: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(packet.byteLength);
    new Uint8Array(buffer).set(packet);
    return buffer;
}
describe("PackageCodec(14 字节大端包头)", () => {
    it("encode 产出具名已知字节数组(normal: op=4, zip=0)", () => {
        const body = new Uint8Array([0xaa]);
        const packet = PackageCodec.encode(100, 19660810, body);
        // totalLength=15(0x0F) | op=4 | zip=0 | uniqueId=100(0x64) | messageId=19660810(0x012C000A) | body
        const expected = new Uint8Array([
            0x00, 0x00, 0x00, 0x0f, 0x04, 0x00, 0x00, 0x00, 0x00, 0x64, 0x01, 0x2c, 0x00, 0x0a, 0xaa,
        ]);
        expect(Array.from(packet)).toEqual(Array.from(expected));
    });

    it("encode 心跳使用 operationType=1;uniqueId 超过 int31 按位回绕为负", () => {
        const packet = PackageCodec.encode(4294967295, 655370, new Uint8Array(0), PackageCodec.OPERATION_TYPE_HEART_BEAT);
        // totalLength=14(0x0E) | op=1 | zip=0 | uniqueId=0xFFFFFFFF | messageId=655370(0x000A000A)
        const expected = new Uint8Array([
            0x00, 0x00, 0x00, 0x0e, 0x01, 0x00, 0xff, 0xff, 0xff, 0xff, 0x00, 0x0a, 0x00, 0x0a,
        ]);
        expect(Array.from(packet)).toEqual(Array.from(expected));
    });

    it("totalLength 语义为含头总长(14 + body.length)", () => {
        const body = new Uint8Array(32);
        const packet = PackageCodec.encode(1, 2, body);
        const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
        expect(view.getUint32(0, false)).toBe(PackageCodec.HEADER_LENGTH + 32);
        expect(packet.byteLength).toBe(PackageCodec.HEADER_LENGTH + 32);
    });

    it("readHeader 按大端解析全部头字段,不校验 operationType 值", () => {
        const raw = new Uint8Array([
            0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0xff, 0xff, 0xf0, 0x00, 0x01, 0x2c, 0x00, 0x0a, 0x01, 0x02,
        ]);
        const header = PackageCodec.readHeader(raw);
        expect(header).not.toBeNull();
        expect(header?.packetLength).toBe(16);
        expect(header?.operationType).toBe(0);
        expect(header?.zipFlag).toBe(0);
        expect(header?.uniqueId).toBe(-4096); // 0xFFFFF000 大端 int32
        expect(header?.messageId).toBe(19660810);
    });

    it("readHeader 不足 14 字节返回 null(半包等待)", () => {
        expect(PackageCodec.readHeader(new Uint8Array(13))).toBeNull();
    });

    it("encode → decode 往返:头字段与 body 逐字节一致", () => {
        const body = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
        const packet = PackageCodec.encode(777, 19660810, body);
        const decoder = new PackageDecoder();
        decoder.push(toBuffer(packet));
        const frames = decoder.drain();
        expect(frames.length).toBe(1);
        expect(frames[0].packetLength).toBe(19);
        expect(frames[0].operationType).toBe(4);
        expect(frames[0].zipFlag).toBe(0);
        expect(frames[0].uniqueId).toBe(777);
        expect(frames[0].messageId).toBe(19660810);
        expect(Array.from(frames[0].body)).toEqual([1, 2, 3, 4, 5]);
    });

    it("粘包:两帧一次推送,drain 按序切出两帧且互不粘连", () => {
        const packet1 = PackageCodec.encode(1, 100, new Uint8Array([0x0a]));
        const packet2 = PackageCodec.encode(2, 200, new Uint8Array([0x0b, 0x0c]));
        const merged = new Uint8Array(packet1.length + packet2.length);
        merged.set(packet1, 0);
        merged.set(packet2, packet1.length);
        const decoder = new PackageDecoder();
        decoder.push(toBuffer(merged));
        const frames = decoder.drain();
        expect(frames.length).toBe(2);
        expect(frames[0].uniqueId).toBe(1);
        expect(Array.from(frames[0].body)).toEqual([0x0a]);
        expect(frames[1].uniqueId).toBe(2);
        expect(Array.from(frames[1].body)).toEqual([0x0b, 0x0c]);
    });

    it("半包:分两段推送后才能切出完整帧", () => {
        const body = new Uint8Array([0x11, 0x22, 0x33]);
        const packet = PackageCodec.encode(9, 655370, body, PackageCodec.OPERATION_TYPE_HEART_BEAT);
        const decoder = new PackageDecoder();
        decoder.push(toBuffer(packet.slice(0, 8)));
        expect(decoder.drain().length).toBe(0);
        decoder.push(toBuffer(packet.slice(8)));
        const frames = decoder.drain();
        expect(frames.length).toBe(1);
        expect(Array.from(frames[0].body)).toEqual([0x11, 0x22, 0x33]);
    });

    it("半包逐字节推送:跨 14 字节头边界仍完整组帧", () => {
        const packet = PackageCodec.encode(5, 6, new Uint8Array([0xee]));
        const decoder = new PackageDecoder();
        let produced = 0;
        for (const byte of packet) {
            decoder.push(toBuffer(new Uint8Array([byte])));
            produced += decoder.drain().length;
        }
        expect(produced).toBe(1);
        expect(decoder.drain().length).toBe(0);
    });

    it("粘包+半包混合:完整帧立即切出,剩余字节留待下次", () => {
        const packet1 = PackageCodec.encode(1, 100, new Uint8Array([0x0a]));
        const packet2 = PackageCodec.encode(2, 200, new Uint8Array([0x0b]));
        const merged = new Uint8Array(packet1.length + packet2.length);
        merged.set(packet1, 0);
        merged.set(packet2, packet1.length);
        const decoder = new PackageDecoder();
        decoder.push(toBuffer(merged.slice(0, packet1.length + 5)));
        expect(decoder.drain().length).toBe(1);
        expect(decoder.drain().length).toBe(0);
        decoder.push(toBuffer(merged.slice(packet1.length + 5)));
        const rest = decoder.drain();
        expect(rest.length).toBe(1);
        expect(rest[0].uniqueId).toBe(2);
    });

    it("zipFlag=1 帧透传(客户端暂无解压实现,原样交付不抛错)", () => {
        const packet = PackageCodec.encode(3, 4, new Uint8Array([0x09]), 4, 1);
        const decoder = new PackageDecoder();
        decoder.push(toBuffer(packet));
        const frames = decoder.drain();
        expect(frames.length).toBe(1);
        expect(frames[0].zipFlag).toBe(1);
        expect(Array.from(frames[0].body)).toEqual([0x09]);
    });
});
