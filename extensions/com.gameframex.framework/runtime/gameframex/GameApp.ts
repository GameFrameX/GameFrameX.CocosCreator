import GameEntry from "./GameEntry";
import EventSystems from "./event/EventSystems";
import TimerModule from "./timer/TimerModule";
import FsmManager from "./fsm/FsmManager";
import ProcedureManager from "./procedure/ProcedureManager";
import UIManager from "./ui/UIManager";
import type { IFormHelper } from "./ui/IFormHelper";
import NetworkModule from "./network/NetworkModule";
import ConfigModule from "./config/ConfigModule";
import LocalizationModule from "./localization/LocalizationModule";
import SettingModule, { type ISettingStorage } from "./setting/SettingModule";

/** GameApp 装配参数(引擎适配层在启动时提供) */
export interface GameAppOptions {
    /** 设置存储后端(Cocos 侧 sys.localStorage 适配) */
    settingStorage: ISettingStorage;
    /** UI 后端(CocosFormHelper 主轨 / FairyGUIFormHelper 可选轨) */
    formHelper: IFormHelper;
}

/**
 * GameFrameX 静态门面(对照 Unity `com.gameframex.unity.entry/GameApp.*` 分部类)。
 *
 * 契约:
 * - `GameApp.<Domain>` 与 Unity 同名的 10 个静态域;TS 无 partial,故以单文件分区维护
 *   (Unity 分文件注册语义 ≙ 本文件的分区注释)。
 * - `bootstrap(options)` 一次性装配全部模块到 GameEntry(按注册序 init);
 *   `Sound` 域在 Phase 4(AudioSource 组件池)接入,当前 getter 按名解析、未注册即抛错。
 * - 全局唯一 EventSystems:`GameApp.Event` 与 NetworkModule 共享,Socket* / NetworkMissHeartBeat
 *   统一经它订阅派发。
 */
export default class GameApp {
    // ---------------------------------------------------------------- Event
    private static _event: EventSystems | null = null;

    /** 事件域:全局唯一事件池 */
    public static get Event(): EventSystems {
        if (!this._event) {
            this._event = new EventSystems();
        }
        return this._event;
    }

    // ---------------------------------------------------------------- Timer
    /** 定时器域:帧驱动计时(add/addOnce/pause/resume…,对照 Unity TimerComponent) */
    public static get Timer(): TimerModule {
        return GameEntry.getModule<TimerModule>("Timer");
    }

    // ---------------------------------------------------------------- Fsm
    /** 状态机域:CreateFsm/DestroyFsm/HasFsm(对照 Unity FsmComponent) */
    public static get Fsm(): FsmManager {
        return GameEntry.getModule<FsmManager>("Fsm");
    }

    // ---------------------------------------------------------------- Procedure
    /** 流程域:StartProcedure/HasProcedure(对照 Unity ProcedureComponent) */
    public static get Procedure(): ProcedureManager {
        return GameEntry.getModule<ProcedureManager>("Procedure");
    }

    // ---------------------------------------------------------------- UI
    /** 界面域:OpenAsync/Close/Toggle + Normal/Popup/Fixed 组(对照 Unity UIComponent) */
    public static get UI(): UIManager {
        return GameEntry.getModule<UIManager>("UI");
    }

    // ---------------------------------------------------------------- Network
    /** 网络域:connect/call/send(14 字节协议,RPC 配对,30s 心跳) */
    public static get Network(): NetworkModule {
        return GameEntry.getModule<NetworkModule>("Network");
    }

    // ---------------------------------------------------------------- Config
    /** 配置域:loadAsync(loader) 灌注 luban 4 表;GetConfig(tableName) */
    public static get Config(): ConfigModule {
        return GameEntry.getModule<ConfigModule>("Config");
    }

    // ---------------------------------------------------------------- Localization
    /** 本地化域:TbLocalization 灌注、GetString/TranslateText */
    public static get Localization(): LocalizationModule {
        return GameEntry.getModule<LocalizationModule>("Localization");
    }

    // ---------------------------------------------------------------- Setting
    /** 设置域:类型化 KV 持久化(GetBool/SetInt…,对照 Unity SettingComponent) */
    public static get Setting(): SettingModule {
        return GameEntry.getModule<SettingModule>("Setting");
    }

    // ---------------------------------------------------------------- Sound
    /**
     * 声音域:Phase 4 接入(AudioSource 组件池 + SoundsConfig 驱动);
     * 在注册 "Sound" 模块前访问会抛错(显式失败优于静默空实现)。
     */
    public static get Sound(): unknown {
        return GameEntry.getModule("Sound");
    }

    // ---------------------------------------------------------------- 装配
    /**
     * 装配全部模块(重复调用前须先 shutdownAll)。
     * 注册顺序即 initAll 顺序:Timer → Fsm → Procedure → UI → Network → Config → Localization → Setting。
     */
    public static bootstrap(options: GameAppOptions): void {
        if (GameEntry.hasModule("Timer")) {
            throw new Error("[GameApp] 已 bootstrap,重复装配前须先 shutdownAll()");
        }
        const events = this.Event;
        GameEntry.registerModule("Timer", new TimerModule());
        GameEntry.registerModule("Fsm", new FsmManager());
        GameEntry.registerModule("Procedure", new ProcedureManager());
        GameEntry.registerModule("UI", new UIManager(options.formHelper));
        GameEntry.registerModule("Network", new NetworkModule({ events }));
        GameEntry.registerModule("Config", new ConfigModule());
        GameEntry.registerModule("Localization", new LocalizationModule());
        GameEntry.registerModule("Setting", new SettingModule(options.settingStorage));
    }

    /**
     * 逆序关闭全部模块并清空门面缓存。
     */
    public static shutdownAll(): void {
        GameEntry.shutdownAll();
        GameEntry.reset();
        this._event?.clear();
        this._event = null;
    }
}
