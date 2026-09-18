import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import ConfigModule from "../../assets/gameframex/config/ConfigModule";
import { TablesComponent, Tables } from "../../assets/hotfix/config/luban/schema";

const configDir = resolve(__dirname, "../../assets/Bundles/builtin/config");
const loader = (name: string): unknown => JSON.parse(readFileSync(resolve(configDir, `${name}.json`), "utf-8"));

/**
 * ConfigModule 契约:loadAsync(loader, tablesFactory) 注入式灌注(框架不依赖生成物);
 * GetConfig(tableName) 取表;未 loadAsync 先 GetConfig 抛错;shutdown 后可重灌。
 */
describe("ConfigModule", () => {
    it("loadAsync(注入 TablesComponent 工厂)后 GetConfig 返回对应表实例", async () => {
        const config = new ConfigModule();
        const tables = await config.loadAsync(loader, (l) => new TablesComponent(l as (name: string) => never));
        expect(tables.TbItemConfig.get(10001)).toBeDefined();
        expect(config.GetConfig<Tables.TbItemConfig>("TbItemConfig").get(10002)).toBeDefined();
    });

    it("未加载完成时 GetConfig 抛错;不存在的表名抛错", () => {
        const config = new ConfigModule();
        expect(() => config.GetConfig("TbItemConfig")).toThrow();
        void config.loadAsync(loader, (l) => new TablesComponent(l as (name: string) => never));
        expect(() => config.GetConfig("NoSuchTable")).toThrow();
    });

    it("shutdown 清空后再 GetConfig 抛错,可重新 loadAsync", async () => {
        const config = new ConfigModule();
        await config.loadAsync(loader, (l) => new TablesComponent(l as (name: string) => never));
        config.shutdown();
        expect(() => config.GetConfig("TbItemConfig")).toThrow();
        await config.loadAsync(loader, (l) => new TablesComponent(l as (name: string) => never));
        expect(config.GetConfig<import("../../assets/hotfix/config/luban/schema").Tables.TbItemConfig>("TbItemConfig").get(10001)).toBeDefined();
    });
});
