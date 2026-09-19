import { describe, expect, it, vi } from "vitest";
import PlayerService, { type PlayerServiceDeps } from "../../assets/hotfix/manager/PlayerService";
import PlayerManager from "../../assets/hotfix/manager/PlayerManager";
import AccountManager from "../../assets/hotfix/manager/AccountManager";
import ProtoMessageHelper from "../../assets/gameframex/network/ProtoMessageHelper";
import type IMessage from "../../assets/gameframex/network/IMessage";
import { User } from "../../assets/gameframex/protobuf/_0300_User";

/** stub 网络:记录请求序列,按脚本回包(响应与请求一一配对由 uniqueId 保证,测试按序喂) */
function setup(): { service: PlayerService; requests: Array<Record<string, unknown>>; script: Array<{ messageId: number; body: Record<string, unknown> }> } {
    ProtoMessageHelper.reset();
    const entry = (): IMessage => ({
        create: (p: unknown) => ({ ...(p as object) }),
        verify: () => null,
        encode: (p: unknown) => ({ finish: () => new Uint8Array() }),
        decode: () => ({}),
    });
    ProtoMessageHelper.init({
        User: {
            ReqPlayerLogin: entry(),
            RespPlayerLogin: entry(),
            ReqPlayerCreate: entry(),
            RespPlayerCreate: entry(),
            ReqPlayerList: entry(),
            RespPlayerList: entry(),
        },
    });
    User.ReqPlayerLogin.register();
    User.RespPlayerLogin.register();
    User.ReqPlayerCreate.register();
    User.RespPlayerCreate.register();

    const requests: Array<Record<string, unknown>> = [];
    const script: Array<{ messageId: number; body: Record<string, unknown> }> = [];
    const network = {
        call: async (message: unknown) => {
            requests.push(message as Record<string, unknown>);
            const next = script.shift();
            if (!next) {
                throw new Error("无脚本响应");
            }
            return next.body;
        },
    };
    const deps: PlayerServiceDeps = {
        network,
        playerManager: PlayerManager.instance,
        accountManager: AccountManager.instance,
    };
    return { service: new PlayerService(deps), requests, script };
}

describe("PlayerService(玩家流程 RPC)", () => {
    it("createAndLogin:ReqPlayerCreate→ReqPlayerLogin,返回玩家信息", async () => {
        const { service, requests, script } = setup();
        script.push(
            { messageId: 19660812, body: { ErrorCode: 0, PlayerInfo: { Id: 9, Name: "p1", Level: 1 } } },
            { messageId: 19660820, body: { ErrorCode: 0, PlayerInfo: { Id: 9, Name: "p1", Level: 1 } } },
        );

        const player = await service.createAndLogin(42, "p1");
        expect(player.Id).toBe(9);
        expect(requests[0].Id).toBe(42);
        expect(requests[1].Id).toBe(9);
    });

    it("loginPlayer:ReqPlayerLogin 返回玩家信息", async () => {
        const { service, script } = setup();
        script.push({ messageId: 19660820, body: { ErrorCode: 0, PlayerInfo: { Id: 3, Name: "hero", Level: 5 } } });
        const player = await service.loginPlayer(3);
        expect(player.Id).toBe(3);
    });

    it("ErrorCode>0 抛错(含错误码)", async () => {
        const { service, script } = setup();
        script.push({ messageId: 19660820, body: { ErrorCode: 500 } });
        await expect(service.loginPlayer(3)).rejects.toThrow("500");
    });
});
