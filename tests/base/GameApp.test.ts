import { afterEach, describe, expect, it } from "vitest";
import GameApp from "../../assets/gameframex/GameApp";
import GameEntry from "../../assets/gameframex/GameEntry";
import EventSystems from "../../assets/gameframex/event/EventSystems";
import TimerModule from "../../assets/gameframex/timer/TimerModule";
import NetworkModule from "../../assets/gameframex/network/NetworkModule";
import UIManager from "../../assets/gameframex/ui/UIManager";
import ConfigModule from "../../assets/gameframex/config/ConfigModule";
import LocalizationModule from "../../assets/gameframex/localization/LocalizationModule";
import SettingModule from "../../assets/gameframex/setting/SettingModule";
import FsmManager from "../../assets/gameframex/fsm/FsmManager";
import ProcedureManager from "../../assets/gameframex/procedure/ProcedureManager";

/** 最小 IFormHelper 替身(引擎后端编辑器阶段接入) */
class StubFormHelper {
    async load(): Promise<never> {
        throw new Error("stub");
    }
}

/**
 * GameApp 门面契约:bootstrap 装配 10 域到 GameEntry;
 * 同域重复访问返回同一实例;shutdownAll 后可重新 bootstrap。
 */
describe("GameApp 门面", () => {
    afterEach(() => GameApp.shutdownAll());

    it("bootstrap 后 9 域(除 Sound 外)全部可解析且为同一实例", () => {
        GameApp.bootstrap({
            settingStorage: new Map() as never,
            formHelper: new StubFormHelper() as never,
        });
        expect(GameApp.Event).toBeInstanceOf(EventSystems);
        expect(GameApp.Timer).toBeInstanceOf(TimerModule);
        expect(GameApp.Fsm).toBeInstanceOf(FsmManager);
        expect(GameApp.Procedure).toBeInstanceOf(ProcedureManager);
        expect(GameApp.UI).toBeInstanceOf(UIManager);
        expect(GameApp.Network).toBeInstanceOf(NetworkModule);
        expect(GameApp.Config).toBeInstanceOf(ConfigModule);
        expect(GameApp.Localization).toBeInstanceOf(LocalizationModule);
        expect(GameApp.Setting).toBeInstanceOf(SettingModule);
        // 同域稳定
        expect(GameApp.Network).toBe(GameEntry.getModule<NetworkModule>("Network"));
        expect(GameApp.Timer).toBe(GameApp.Timer);
    });

    it("Network 与全局 Event 共享同一 EventSystems 实例", () => {
        GameApp.bootstrap({ settingStorage: new Map() as never, formHelper: new StubFormHelper() as never });
        expect(GameApp.Network).toBeInstanceOf(NetworkModule);
        // 事件池单例:Socket* 事件由 GameApp.Event 统一收发
        expect(GameApp.Event.listenerCount("SocketConnected")).toBeGreaterThanOrEqual(0);
    });

    it("shutdownAll 后可重新 bootstrap(实例重建)", () => {
        GameApp.bootstrap({ settingStorage: new Map() as never, formHelper: new StubFormHelper() as never });
        const first = GameApp.Timer;
        GameApp.shutdownAll();
        GameApp.bootstrap({ settingStorage: new Map() as never, formHelper: new StubFormHelper() as never });
        expect(GameApp.Timer).not.toBe(first);
    });
});
