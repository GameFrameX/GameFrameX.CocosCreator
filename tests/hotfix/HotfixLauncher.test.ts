import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import GameApp from "../../assets/gameframex/GameApp";
import HotfixLauncher from "../../assets/hotfix/HotfixLauncher";
import { Local } from "../../assets/hotfix/config/luban/schema";

/**
 * HotfixLauncher.main 契约(spec §3.4 三步):注册协议(幂等)→ LoadConfig(loader 注入)
 * → 本地化灌注 → OpenAsync UILogin(未注册时告警不阻断)。
 */
const configDir = resolve(__dirname, "../../assets/Bundles/builtin/config");
const fsLoader = (name: string): unknown => JSON.parse(readFileSync(resolve(configDir, `${name}.json`), "utf-8"));

describe("HotfixLauncher.main(引擎无关注入版)", () => {
    it("main 后配置与本地化就绪,GameLauncherState 后继链路可用", async () => {
        GameApp.bootstrap({
            settingStorage: new Map() as never,
            // UI 后端替身:UILogin 尚未注册(Port3/6),main 应告警而不阻断
            formHelper: {
                load: () => {
                    throw new Error("no ui");
                },
            } as never,
        });
        await HotfixLauncher.main(fsLoader as (name: string) => never);

        expect(GameApp.Config.GetConfig<Local.TbLocalization>("TbLocalization").getDataList().length).toBe(114);
        GameApp.Localization.setLanguage("ChineseSimplified");
        expect(GameApp.Localization.DictionaryCount).toBeGreaterThan(0);
        expect(GameApp.Localization.GetString("text_achievement_name_01")).toContain("独自享受的日常");
        GameApp.shutdownAll();
    });
});
