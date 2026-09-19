import { afterEach, describe, expect, it, vi } from "vitest";
import FsmManager from "../../assets/gameframex/fsm/FsmManager";
import ProcedureBase from "../../assets/gameframex/procedure/ProcedureBase";
import ProcedureManager from "../../assets/gameframex/procedure/ProcedureManager";
import BlackBoardKeys from "../../assets/scripts/framework/procedure/BlackBoardKeys";
import ProcedureCreateDownloader from "../../assets/scripts/framework/procedure/ProcedureCreateDownloader";
import ProcedureDownloadWebFiles from "../../assets/scripts/framework/procedure/ProcedureDownloadWebFiles";
import ProcedureGameLauncherState from "../../assets/scripts/framework/procedure/ProcedureGameLauncherState";
import ProcedureGetAppVersionInfoState from "../../assets/scripts/framework/procedure/ProcedureGetAppVersionInfoState";
import ProcedureGetGameAssetPackageVersionInfoByDefaultPackageState from "../../assets/scripts/framework/procedure/ProcedureGetGameAssetPackageVersionInfoByDefaultPackageState";
import ProcedureGetGlobalInfoState from "../../assets/scripts/framework/procedure/ProcedureGetGlobalInfoState";
import ProcedureLauncherState from "../../assets/scripts/framework/procedure/ProcedureLauncherState";
import ProcedurePatchDone from "../../assets/scripts/framework/procedure/ProcedurePatchDone";
import ProcedurePatchInit from "../../assets/scripts/framework/procedure/ProcedurePatchInit";
import ProcedureUpdateManifest from "../../assets/scripts/framework/procedure/ProcedureUpdateManifest";
import ProcedureUpdateStaticVersion from "../../assets/scripts/framework/procedure/ProcedureUpdateStaticVersion";
import { run as runPatchHarness } from "./patch.harness";

/**
 * Procedure 契约(对照 Unity GameFrameX.Procedure.Runtime + 启动链 spec §3.4):
 * ProcedureManager 启动后按 11 状态固定链序流转,BlackBoard 数据跨状态传递。
 */
describe("ProcedureManager + 11 启动流程", () => {
    const EXPECTED_CHAIN = [
        "ProcedureLauncherState",
        "ProcedureGetGlobalInfoState",
        "ProcedureGetAppVersionInfoState",
        "ProcedureGetGameAssetPackageVersionInfoByDefaultPackageState",
        "ProcedurePatchInit",
        "ProcedureUpdateStaticVersion",
        "ProcedureUpdateManifest",
        "ProcedureCreateDownloader",
        "ProcedureDownloadWebFiles",
        "ProcedurePatchDone",
        "ProcedureGameLauncherState",
    ];

    /** 11 个启动流程骨架,按启动链序注册。 */
    function createProcedures(): ProcedureBase[] {
        return [
            new ProcedureLauncherState(),
            new ProcedureGetGlobalInfoState(),
            new ProcedureGetAppVersionInfoState(),
            new ProcedureGetGameAssetPackageVersionInfoByDefaultPackageState(),
            new ProcedurePatchInit(),
            new ProcedureUpdateStaticVersion(),
            new ProcedureUpdateManifest(),
            new ProcedureCreateDownloader(),
            new ProcedureDownloadWebFiles(),
            new ProcedurePatchDone(),
            new ProcedureGameLauncherState(),
        ];
    }

    function buildStartup(): { fsmManager: FsmManager; procedureManager: ProcedureManager } {
        const fsmManager = new FsmManager();
        const procedureManager = new ProcedureManager();
        procedureManager.Initialize(fsmManager, createProcedures());
        return { fsmManager, procedureManager };
    }

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("启动后按 11 状态固定链序流转,BlackBoard 追加链序轨迹", () => {
        const { fsmManager, procedureManager } = buildStartup();
        procedureManager.StartProcedure(ProcedureLauncherState);

        const fsm = fsmManager.GetFsm(ProcedureManager, "Procedure");
        expect(fsm).not.toBeNull();
        expect(fsm!.GetData<string[]>(BlackBoardKeys.StartupTrace)).toEqual(EXPECTED_CHAIN);
        expect(procedureManager.CurrentProcedure).toBeInstanceOf(ProcedureGameLauncherState);
        expect(fsm!.CurrentStateName).toBe("ProcedureGameLauncherState");
    });

    it("启动前注入的 BlackBoard 数据跨越全部 11 状态仍可读", () => {
        const { fsmManager, procedureManager } = buildStartup();
        const fsm = fsmManager.GetFsm(ProcedureManager, "Procedure")!;
        const options = { mode: "editor" };
        fsm.SetData(BlackBoardKeys.StartupOptions, options);

        procedureManager.StartProcedure(ProcedureLauncherState);

        expect(fsm.GetData<{ mode: string }>(BlackBoardKeys.StartupOptions)).toEqual(options);
    });

    it("未注入 HotfixLauncher 时:Patch 段降级直通,链日志齐备", () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { procedureManager } = buildStartup();
        procedureManager.StartProcedure(ProcedureLauncherState);

        const procedureLogs = logSpy.mock.calls.filter((args) => String(args[0]).startsWith("[GameFrameX][Procedure]"));
        expect(procedureLogs).toHaveLength(4);
        expect(procedureLogs.some((args) => String(args[0]).includes("[ProcedureLauncherState]"))).toBe(true);
        const gameLauncherWarns = warnSpy.mock.calls.filter((args) => String(args[0]).includes("未注入 StartupHotfixLauncher"));

        expect(warnSpy.mock.calls.filter((args) => String(args[0]).includes("未注入 StartupHotfixLauncher"))).toHaveLength(1);
        expect(warnSpy.mock.calls.filter((args) => String(args[0]).includes("未注入 PatchContext")).length).toBe(6);
    });

    it("注入 HotfixLauncher 后:GameLauncherState 移交 main() 且链日志 11 条", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {
        });
        const mainCalls: number[] = [];
        const { procedureManager } = buildStartup();
        procedureManager.BlackBoard.SetData("__startup_hotfix_launcher__", {
            main: () => {
                mainCalls.push(1);
                return Promise.resolve();
            },
        });
        procedureManager.StartProcedure(ProcedureLauncherState);
        await Promise.resolve();

        expect(mainCalls).toHaveLength(1);
        const procedureLogs = logSpy.mock.calls.filter((args) => String(args[0]).startsWith("[GameFrameX][Procedure]") || String(args[0]).startsWith("[GameFrameX][Patch]"));
        expect(procedureLogs).toHaveLength(5);
    });

    it("HasProcedure/GetProcedure 查询注册流程", () => {
        const { procedureManager } = buildStartup();

        expect(procedureManager.HasProcedure(ProcedurePatchInit)).toBe(true);
        expect(procedureManager.GetProcedure(ProcedurePatchDone)).toBeInstanceOf(ProcedurePatchDone);

        class UnknownProcedure extends ProcedureBase {
        }

        expect(procedureManager.HasProcedure(UnknownProcedure)).toBe(false);
        expect(procedureManager.GetProcedure(UnknownProcedure)).toBeNull();
    });

    it("未 Initialize 即调用抛错", () => {
        const procedureManager = new ProcedureManager();
        expect(() => procedureManager.StartProcedure(ProcedureLauncherState)).toThrow("You must initialize procedure first.");
        expect(() => procedureManager.CurrentProcedure).toThrow("You must initialize procedure first.");
        expect(() => procedureManager.CurrentProcedureTime).toThrow("You must initialize procedure first.");
    });

    it("Initialize 参数校验", () => {
        const procedureManager = new ProcedureManager();
        expect(() => procedureManager.Initialize(null as unknown as FsmManager, createProcedures())).toThrow("fsmManager is invalid.");
        expect(() => procedureManager.Initialize(new FsmManager(), [])).toThrow("Procedures is invalid.");
    });

    it("FsmManager.update(dt) 继续驱动流程状态机", () => {
        const { fsmManager, procedureManager } = buildStartup();
        procedureManager.StartProcedure(ProcedureLauncherState);

        fsmManager.update(0.25);

        expect(procedureManager.CurrentProcedureTime).toBeCloseTo(0.25, 10);
    });

    it("DestroyProcedures 清理状态机;ReinitializeProcedures 后可重新走完整链", () => {
        const { fsmManager, procedureManager } = buildStartup();
        procedureManager.StartProcedure(ProcedureLauncherState);

        procedureManager.DestroyProcedures();
        expect(fsmManager.HasFsm(ProcedureManager, "Procedure")).toBe(false);
        expect(() => procedureManager.CurrentProcedure).toThrow("You must initialize procedure first.");

        procedureManager.ReinitializeProcedures(createProcedures());
        procedureManager.StartProcedure(ProcedureLauncherState);
        const fsm = fsmManager.GetFsm(ProcedureManager, "Procedure");
        expect(fsm!.GetData<string[]>(BlackBoardKeys.StartupTrace)).toEqual(EXPECTED_CHAIN);
    });

    it("shutdown 销毁流程状态机并释放 FsmManager 依赖", () => {
        const { fsmManager, procedureManager } = buildStartup();
        procedureManager.StartProcedure(ProcedureLauncherState);

        procedureManager.shutdown();

        expect(fsmManager.HasFsm(ProcedureManager, "Procedure")).toBe(false);
        expect(() => procedureManager.CurrentProcedure).toThrow("You must initialize procedure first.");
    });
});


describe("Patch 六步实装(注入态)", () => {
    it("注入 PatchContext:六步走完,差异 Bundle 被加载,进度事件齐备,版本落盘", async () => {
        const localVersions = new Map([["patch.version.remote", "hash-v1"]]);
        const result = await runPatchHarness({
            manifest: { version: 2, bundles: { remote: "hash-v2" } },
            localVersions,
        });
        expect(result.reachedGameLauncher).toBe(true);
        expect(result.loadedBundles).toEqual(["remote"]);
        expect(result.progressEvents.some((e) => e.stage === "PatchInit" && e.progress === 0)).toBe(true);
        expect(result.progressEvents.some((e) => e.stage === "DownloadWebFiles" && e.progress === 1)).toBe(true);
        expect(result.progressEvents.some((e) => e.stage === "PatchDone")).toBe(true);
        expect(localVersions.get("patch.version.remote")).toBe("hash-v2");
    });
});
