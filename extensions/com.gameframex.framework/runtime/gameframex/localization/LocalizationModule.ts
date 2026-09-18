import type { IModule } from "../GameEntry";

/** luban 生成的 TbLocalization 行形状(key + 各语言列) */
interface LocalizationRow {
    key: string;
}

/**
 * 本地化模块(对照 Unity LocalizationComponent 契约;spec §3.3)。
 *
 * 契约:
 * - `loadFromTbLocalization(dataList)` 将 TbLocalization 全量灌注为 `语言 → Map<key, text>`(空文案列不灌注)。
 * - `GetString(key, ...args)` 按当前语言取文案并做 {0}/{1} 占位替换;未命中返回 key 本身(与 Unity 回退语义一致)。
 * - `TranslateText(key, originText)` 实现 luban 表 translator 委托签名:命中返回译文,未命中回退原文。
 * - `setLanguage` 切换当前语言;引擎无关,系统语言探测在引擎适配层注入。
 */
export default class LocalizationModule implements IModule {
    private _dictionaries: Map<string, Map<string, string>> = new Map();
    private _language: string = "";
    private _defaultLanguage: string = "ChineseSimplified";

    /**
     * 灌注 TbLocalization 数据行(可多次调用,增量合并)。
     */
    public loadFromTbLocalization(dataList: ReadonlyArray<LocalizationRow>): void {
        for (const row of dataList) {
            for (const [language, text] of Object.entries(row as unknown as Record<string, unknown>)) {
                if (language === "key" || typeof text !== "string" || text.length === 0) {
                    continue;
                }
                let dictionary = this._dictionaries.get(language);
                if (!dictionary) {
                    dictionary = new Map();
                    this._dictionaries.set(language, dictionary);
                }
                dictionary.set(row.key, text);
            }
        }
    }

    /**
     * 直接注入单条文案(占位/测试/运行时补充用)。
     */
    public addRaw(key: string, text: string): void {
        let dictionary = this._dictionaries.get(this._language);
        if (!dictionary) {
            dictionary = new Map();
            this._dictionaries.set(this._language, dictionary);
        }
        dictionary.set(key, text);
    }

    /**
     * 设置当前语言(如 "ChineseSimplified"/"English");未灌注该语言时字典为空,GetString 回退 key。
     */
    public setLanguage(language: string): void {
        this._language = language;
    }

    public get Language(): string {
        return this._language;
    }

    public get DefaultLanguage(): string {
        return this._defaultLanguage;
    }

    public set DefaultLanguage(language: string) {
        this._defaultLanguage = language;
    }

    /**
     * 当前语言词条数(诊断用)。
     */
    public get DictionaryCount(): number {
        return this.currentDictionary.size;
    }

    private get currentDictionary(): Map<string, string> {
        return this._dictionaries.get(this._language) ?? new Map();
    }

    /**
     * 取文案并做 {0}、{1}… 占位替换;未命中回退 key 本身。
     */
    public GetString(key: string, ...args: unknown[]): string {
        let text = this.currentDictionary.get(key) ?? this._dictionaries.get(this._defaultLanguage)?.get(key) ?? key;
        args.forEach((arg, index) => {
            text = text.split(`{${index}}`).join(String(arg));
        });
        return text;
    }

    /**
     * luban 表 translator 契约:(key, 原文) → 译文;未命中回退原文。
     */
    public TranslateText(key: string, originText: string): string {
        const translated = this.currentDictionary.get(key) ?? this._dictionaries.get(this._defaultLanguage)?.get(key);
        return translated ?? originText;
    }

    public async init(): Promise<void> {}

    public update(_dt: number): void {}

    public shutdown(): void {
        this._dictionaries.clear();
    }
}
