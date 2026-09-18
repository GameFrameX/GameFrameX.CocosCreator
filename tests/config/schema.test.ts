import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TablesComponent, Tables, Local } from "../../assets/hotfix/config/luban/schema";

/**
 * ConfigModule 契约:loadAsync(loader) 灌注 4 表;GetConfig(tableName) 取表;
 * 未加载完成时 GetConfig 抛错;表行数与 Godot/Unity 基线一致(12/114/2/8)。
 */

const configDir = resolve(__dirname, "../../assets/Bundles/builtin/config");
const loader = (name: string): unknown => JSON.parse(readFileSync(resolve(configDir, `${name}.json`), "utf-8"));

describe("luban TablesComponent(真数据)", () => {
    it("4 表加载:TbItem 12 行、TbLocalization 114 行、TbAchievement 2 行、TbSounds 8 行(与 Unity 基线一致)", () => {
        const tables = new TablesComponent(loader as (name: string) => never);
        expect(tables.TbItemConfig instanceof Tables.TbItemConfig).toBe(true);
        expect(tables.TbLocalization instanceof Local.TbLocalization).toBe(true);
        expect(tables.TbItemConfig.getDataList().length).toBe(12);
        expect(tables.TbLocalization.getDataList().length).toBe(114);
        expect(tables.TbAchievementConfig.getDataList().length).toBe(2);
        expect(tables.TbSoundsConfig.getDataList().length).toBe(8);
    });

    it("TbItemConfig 按 id 取行,字段可读", () => {
        const tables = new TablesComponent(loader as (name: string) => never);
        const item = tables.TbItemConfig.get(10001);
        expect(item).toBeDefined();
        expect(item!.Icon).toBe("item/diamond1.png");
    });
});
