import { describe, expect, it } from "vitest";
import SettingModule from "../../assets/gameframex/setting/SettingModule";

/** 内存 KV 测试替身(引擎适配为 sys.localStorage) */
class MemoryStorage {
    public map: Map<string, string> = new Map();
    getItem(key: string): string | null {
        return this.map.get(key) ?? null;
    }
    setItem(key: string, value: string): void {
        this.map.set(key, value);
    }
    removeItem(key: string): void {
        this.map.delete(key);
    }
    keys(): string[] {
        return [...this.map.keys()];
    }
}

/**
 * SettingModule 契约(对齐 Unity SettingComponent):KV 持久化(注入存储);
 * Get/Set Bool/Int/Float/String + 默认值;Has/Remove/RemoveAll;写入穿透存储。
 */
describe("SettingModule", () => {
    it("Set 后 Get 返回同值(bool/int/float/string)", () => {
        const setting = new SettingModule(new MemoryStorage());
        setting.SetBool("sound", true);
        setting.SetInt("quality", 2);
        setting.SetFloat("volume", 0.5);
        setting.SetString("nickname", "player");
        expect(setting.GetBool("sound")).toBe(true);
        expect(setting.GetInt("quality")).toBe(2);
        expect(setting.GetFloat("volume")).toBe(0.5);
        expect(setting.GetString("nickname")).toBe("player");
    });

    it("未设置的 key 返回默认值;无默认值时返回类型零值", () => {
        const setting = new SettingModule(new MemoryStorage());
        expect(setting.GetInt("nope", 7)).toBe(7);
        expect(setting.GetBool("nope")).toBe(false);
        expect(setting.GetString("nope", "fallback")).toBe("fallback");
        expect(setting.GetFloat("nope", 1.5)).toBe(1.5);
    });

    it("Has/Remove/RemoveAll/Count 语义正确", () => {
        const setting = new SettingModule(new MemoryStorage());
        setting.SetString("a", "1");
        setting.SetString("b", "2");
        expect(setting.HasSetting("a")).toBe(true);
        expect(setting.Count).toBe(2);
        setting.RemoveSetting("a");
        expect(setting.HasSetting("a")).toBe(false);
        setting.RemoveAllSettings();
        expect(setting.HasSetting("b")).toBe(false);
        expect(setting.Count).toBe(0);
    });

    it("写入穿透到注入的存储(持久化语义)", () => {
        const storage = new MemoryStorage();
        const setting = new SettingModule(storage);
        setting.SetString("key", "value");
        expect(storage.map.get("key")).toBe("value");
    });
});
