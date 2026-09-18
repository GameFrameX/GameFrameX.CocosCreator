/**
 * 唯一 ID 生成器。
 *
 * 契约:进程内单调递增的正整数 ID;达到 uint32 上限后归零重来。
 * 网络层 MessageObject 构造时取其作为 UniqueId,RPC 请求-响应配对依赖该唯一性。
 */
export default class UtilityIdGenerator {
    private static _id: number = Math.floor((new Date().getTime() - new Date(2000, 1, 1, 0, 0, 0).getTime()) / 1000_0000);

    private static readonly MAX_ID: number = 2 ** 32 - 1;

    public static getUniqueIntId(): number {
        if (this._id >= this.MAX_ID) {
            this._id = 0;
        }

        return ++this._id;
    }
}
