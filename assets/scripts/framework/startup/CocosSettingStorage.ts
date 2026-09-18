import { sys } from "cc";
import type { ISettingStorage } from "../../../gameframex/setting/SettingModule";

const KEYS_INDEX = "__gfx_setting_keys__";

/**
 * sys.localStorage 设置存储适配(ISettingStorage 的 Cocos 实现)。
 *
 * 契约:键索引持久化在保留键 `__gfx_setting_keys__`(JSON 数组)——
 * sys.localStorage 无枚举 API,Set/Remove 时同步维护索引,keys() 读索引。
 */
export default class CocosSettingStorage implements ISettingStorage {
    private readIndex(): Set<string> {
        const raw = sys.localStorage.getItem(KEYS_INDEX);
        if (!raw) {
            return new Set();
        }
        try {
            return new Set(JSON.parse(raw) as string[]);
        } catch {
            return new Set();
        }
    }

    private writeIndex(index: Set<string>): void {
        sys.localStorage.setItem(KEYS_INDEX, JSON.stringify(Array.from(index)));
    }

    public getItem(key: string): string | null {
        return sys.localStorage.getItem(key);
    }

    public setItem(key: string, value: string): void {
        if (key === KEYS_INDEX) {
            throw new Error("[CocosSettingStorage] 保留键不可用作设置项");
        }
        sys.localStorage.setItem(key, value);
        const index = this.readIndex();
        index.add(key);
        this.writeIndex(index);
    }

    public removeItem(key: string): void {
        sys.localStorage.removeItem(key);
        const index = this.readIndex();
        index.delete(key);
        this.writeIndex(index);
    }

    public keys(): string[] {
        return Array.from(this.readIndex());
    }
}
