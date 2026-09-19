import { describe, expect, it } from "vitest";
import AccountManager from "../../assets/hotfix/manager/AccountManager";
import PlayerManager from "../../assets/hotfix/manager/PlayerManager";

/**
 * AccountManager/PlayerManager 契约(对照 Unity Hotfix/Manager 同名):
 * - AccountManager:登录账号(Id)与角色列表缓存;选择角色 Id 记录。
 * - PlayerManager:当前玩家信息缓存;set 后跨界面可读。
 */
describe("AccountManager / PlayerManager", () => {
    it("AccountManager:账号 Id 与角色列表缓存,角色选择记录", () => {
        const account = AccountManager.instance;
        account.AccountId = 42;
        account.PlayerList = [{ Id: 7, Name: "hero", Level: 3 }];
        expect(account.AccountId).toBe(42);
        expect(account.PlayerList).toHaveLength(1);
        account.SelectedPlayerId = 7;
        expect(account.SelectedPlayerId).toBe(7);
    });

    it("PlayerManager:当前玩家信息缓存", () => {
        const player = PlayerManager.instance;
        player.PlayerInfo = { Id: 7, Name: "hero", Level: 3 };
        expect(player.PlayerInfo?.Name).toBe("hero");
    });
});
