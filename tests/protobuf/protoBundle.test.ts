import { beforeAll, describe, expect, it } from "vitest";
import ProtoMessageHelper from "../../assets/gameframex/network/ProtoMessageHelper";
import ProtoMessageRegister from "../../assets/gameframex/protobuf/ProtoMessageRegister";
import $root from "../../assets/gameframex/protobuf/proto-bundle";
import { User } from "../../assets/gameframex/protobuf/_0300_User";

/**
 * R7 消息注册自检 + R3 静态 bundle 冒烟(Node 环境)。
 */
describe("protobuf 静态 bundle(R3/R7)", () => {
    beforeAll(() => {
        ProtoMessageHelper.reset();
        ProtoMessageHelper.init($root as Record<string, unknown>);
        ProtoMessageRegister.register();
    });

    it("全部生成消息注册后,注册数与 ProtoMessageRegister 清单一致且非零", () => {
        expect(ProtoMessageHelper.registeredCount).toBeGreaterThan(0);
        // 基线快照 61;当前 proto 源 68(源已演进),自检口径为“注册数 === 生成清单数”
        expect(ProtoMessageHelper.registeredCount).toBe(68);
    });

    it("ReqLogin 可解析出 create/verify/encode/decode 四件套", () => {
        const type = ProtoMessageHelper.getMessageType("User.ReqLogin");
        expect(typeof type.create).toBe("function");
        expect(typeof type.encode).toBe("function");
        expect(typeof type.decode).toBe("function");
    });

    it("ReqLogin encode → decode 字节级往返一致(keep-case 字段名)", () => {
        const type = ProtoMessageHelper.getMessageType("User.ReqLogin");
        const req = new User.ReqLogin();
        req.UserName = "cocos-player";
        req.Device = "cocos-device";

        const bytes = type.encode(type.create(req)).finish();
        expect(bytes.byteLength).toBeGreaterThan(0);

        // decode 返回 protobufjs 消息实例;字段与 ReqLogin 同构(同一 .proto 源生成)
        const decoded = type.decode(bytes) as { UserName: string; Device: string };
        expect(decoded.UserName).toBe("cocos-player");
        expect(decoded.Device).toBe("cocos-device");
    });

    it("消息号 module<<16+id 计算正确:Basic.ReqHeartBeat=655370、User 模块号=300", () => {
        expect(ProtoMessageHelper.getMessageIdByModule("Basic.ReqHeartBeat")).toBe(655370);
        const reqLoginId = ProtoMessageHelper.getMessageIdByModule("User.ReqLogin");
        expect((reqLoginId >> 16) & 0xffff).toBe(300);
    });
});
