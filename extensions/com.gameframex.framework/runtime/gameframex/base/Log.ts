/**
 * 日志门面(引擎无关;对照 Unity GameFrameX Log 语义)。
 *
 * 契约:统一 `[GameFrameX][tag]` 前缀;Debug 仅开发构建输出。
 * 发布构建可通过 `Log.enabled = false` 全局关闭。
 */
export default class Log {
    /** 全局开关(发布构建可关闭) */
    public static enabled: boolean = true;
    /** 是否输出 Debug 级别 */
    public static debugEnabled: boolean = true;

    private static _prefix: string = "[GameFrameX]";

    public static debug(tag: string, message: string, ...args: unknown[]) {
        if (this.enabled && this.debugEnabled) {
            console.log(`${this._prefix}[${tag}] ${message}`, ...args);
        }
    }

    public static info(tag: string, message: string, ...args: unknown[]) {
        if (this.enabled) {
            console.log(`${this._prefix}[${tag}] ${message}`, ...args);
        }
    }

    public static warn(tag: string, message: string, ...args: unknown[]) {
        if (this.enabled) {
            console.warn(`${this._prefix}[${tag}] ${message}`, ...args);
        }
    }

    public static error(tag: string, message: string, ...args: unknown[]) {
        if (this.enabled) {
            console.error(`${this._prefix}[${tag}] ${message}`, ...args);
        }
    }
}
