import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import LocalizationModule from "../../assets/gameframex/localization/LocalizationModule";
import { Local } from "../../assets/hotfix/config/luban/schema";

const configDir = resolve(__dirname, "../../assets/Bundles/builtin/config");
const loader = (name: string): unknown => JSON.parse(readFileSync(resolve(configDir, `${name}.json`), "utf-8"));
const tbLocalization = new Local.TbLocalization(loader("local_tblocalization") as never);

/**
 * LocalizationModule 契约:TbLocalization 灌注 → 按语言取 key;
 * GetString 支持 {0} 占位;TranslateText(key, origin) 无命中回退原文;切语言生效。
 */
describe("LocalizationModule", () => {
    it("灌注后 GetString 按 ChineseSimplified 返回文案", () => {
        const localization = new LocalizationModule();
        localization.loadFromTbLocalization(tbLocalization.getDataList());
        localization.setLanguage("ChineseSimplified");
        expect(localization.GetString("text_achievement_name_01")).toBe("\u00A0独自享受的日常");
    });

    it("GetString 支持 {0} 占位参数", () => {
        const localization = new LocalizationModule();
        localization.loadFromTbLocalization(tbLocalization.getDataList());
        localization.setLanguage("ChineseSimplified");
        localization.addRaw("placeholder.demo", "第 {0} 关 - {1}");
        expect(localization.GetString("placeholder.demo", 3, "boss")).toBe("第 3 关 - boss");
    });

    it("TranslateText:key 命中返回译文,未命中回退原文(luban translator 契约)", () => {
        const localization = new LocalizationModule();
        localization.loadFromTbLocalization(tbLocalization.getDataList());
        localization.setLanguage("ChineseSimplified");
        expect(localization.TranslateText("text_achievement_name_01", "fallback")).toBe("\u00A0独自享受的日常");
        expect(localization.TranslateText("no.such.key", "fallback")).toBe("fallback");
    });

    it("切语言后未知 key 回退 key 本身;已译 key 在未译语言回退默认语言", () => {
        const localization = new LocalizationModule();
        localization.loadFromTbLocalization(tbLocalization.getDataList());
        localization.setLanguage("English");
        expect(localization.DictionaryCount).toBeGreaterThan(0);
        // English 列全空:该语言词条来自占位注入以外为 0,已译 key 回退默认语言(ChineseSimplified)
        expect(localization.GetString("text_achievement_name_01")).toBe("\u00A0独自享受的日常");
        // 全字典不存在的 key:回退 key 本身
        expect(localization.GetString("no.such.key")).toBe("no.such.key");
    });
});
