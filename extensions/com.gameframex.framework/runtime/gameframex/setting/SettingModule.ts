import type { IModule } from "../GameEntry";

/**
 * KV 存储适配接口(引擎侧实现:Cocos sys.localStorage / 测试:内存 Map)。
 * 签名与 Web Storage 对齐(getItem/setItem/removeItem)。
 */
export interface ISettingStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    /** 枚举全部键(适配层负责实现;Cocos 侧以索引键方案维护) */
    keys(): string[];
}

/**
 * 设置模块(对照 Unity SettingComponent 同名 API;spec §2 setting/)。
 *
 * 契约:类型化 KV 持久化;bool→"true"/"false"、数字→十进制字符串、字符串原样;
 * Get 未命中返回默认值(未提供则为类型零值);引擎无关,存储后端由构造注入。
 */
export default class SettingModule implements IModule {
    private _storage: ISettingStorage;

    constructor(storage: ISettingStorage) {
        this._storage = storage;
    }

    /**
     * 是否存在指定设置项。
     */
    public HasSetting(settingName: string): boolean {
        return this._storage.getItem(settingName) !== null;
    }

    /**
     * 删除指定设置项。
     */
    public RemoveSetting(settingName: string): void {
        this._storage.removeItem(settingName);
    }

    /**
     * 删除全部设置项。
     */
    public RemoveAllSettings(): void {
        for (const name of this._storage.keys()) {
            this._storage.removeItem(name);
        }
    }

    /**
     * 全部设置项名(枚举由存储适配层提供)。
     */
    public GetAllSettingNames(): string[] {
        return this._storage.keys();
    }

    /**
     * 设置项数量。
     */
    public get Count(): number {
        return this.GetAllSettingNames().length;
    }

    public GetBool(settingName: string, defaultValue: boolean = false): boolean {
        const raw = this._storage.getItem(settingName);
        if (raw === null) {
            return defaultValue;
        }
        return raw === "true";
    }

    public SetBool(settingName: string, value: boolean): void {
        this._storage.setItem(settingName, value ? "true" : "false");
    }

    public GetInt(settingName: string, defaultValue: number = 0): number {
        const raw = this._storage.getItem(settingName);
        if (raw === null) {
            return defaultValue;
        }
        const parsed = parseInt(raw, 10);
        return Number.isNaN(parsed) ? defaultValue : parsed;
    }

    public SetInt(settingName: string, value: number): void {
        this._storage.setItem(settingName, String(value));
    }

    public GetFloat(settingName: string, defaultValue: number = 0): number {
        const raw = this._storage.getItem(settingName);
        if (raw === null) {
            return defaultValue;
        }
        const parsed = parseFloat(raw);
        return Number.isNaN(parsed) ? defaultValue : parsed;
    }

    public SetFloat(settingName: string, value: number): void {
        this._storage.setItem(settingName, String(value));
    }

    public GetString(settingName: string, defaultValue: string = ""): string {
        return this._storage.getItem(settingName) ?? defaultValue;
    }

    public SetString(settingName: string, value: string): void {
        this._storage.setItem(settingName, value);
    }

    /**
     * 立即持久化(Cocos localStorage 同步写,保留 API 对齐 Unity Save())。
     */
    public Save(): void {}

    public async init(): Promise<void> {}

    public update(_dt: number): void {}

    public shutdown(): void {}
}
