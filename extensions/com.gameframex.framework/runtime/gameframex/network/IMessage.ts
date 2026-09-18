/**
 * protobuf 消息 Type 契约(pbjs static-module 产物与 protobufjs Type 静态用法对齐)。
 *
 * encode/decode 即 protobufjs 语义:create 构造合法消息对象,verify 返回 null 表示通过,
 * encode 输出二进制,decode 从二进制还原消息对象。
 */
export default interface IMessage {
    create(payload: unknown): unknown;
    verify(payload: unknown): string | null;
    encode(payload: unknown): { finish(): Uint8Array };
    decode(payload: Uint8Array): unknown;
}
