import { _decorator, Component, Node } from "cc";
import GameApp from "../../../gameframex/GameApp";
import Log from "../../../gameframex/base/Log";
import ProtoMessageHelper from "../../../gameframex/network/ProtoMessageHelper";
import ProtoMessageRegister from "../../../gameframex/protobuf/ProtoMessageRegister";
import type ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import CocosFormHelper from "./CocosFormHelper";
import GameEntryComponent, { reportStage } from "./GameEntryComponent";
import CocosSettingStorage from "./CocosSettingStorage";
import ProcedureLauncherState from "../procedure/ProcedureLauncherState";
import ProcedureGetGlobalInfoState from "../procedure/ProcedureGetGlobalInfoState";
import ProcedureGetAppVersionInfoState from "../procedure/ProcedureGetAppVersionInfoState";
import ProcedureGetGameAssetPackageVersionInfoByDefaultPackageState from "../procedure/ProcedureGetGameAssetPackageVersionInfoByDefaultPackageState";
import ProcedurePatchInit from "../procedure/ProcedurePatchInit";
import ProcedureUpdateStaticVersion from "../procedure/ProcedureUpdateStaticVersion";
import ProcedureUpdateManifest from "../procedure/ProcedureUpdateManifest";
import ProcedureCreateDownloader from "../procedure/ProcedureCreateDownloader";
import ProcedureDownloadWebFiles from "../procedure/ProcedureDownloadWebFiles";
import ProcedurePatchDone from "../procedure/ProcedurePatchDone";
import ProcedureGameLauncherState from "../procedure/ProcedureGameLauncherState";
// pbjs static-module 产物(default 即 $root 命名空间根)
import $root from "../../../gameframex/protobuf/proto-bundle";
import { FRAMEWORK_VERSION } from "../../../gameframex/FrameworkVersion";

const { ccclass, property } = _decorator;

/** 当前 proto 源生成消息数(与 tests/protobuf 自检一致;源演进时同步更新) */
const EXPECTED_MESSAGE_COUNT = 68;

/**
 * 应用启动入口(对照 Unity ApplicationStartupEntry;spec §3.4 启动链)。
 *
 * 契约:场景加载后自动执行——装配 GameApp → 注册 68 消息与静态 bundle →
 * R7 自检 → 启动 11 步 Procedure(Launcher → … → GameLauncherState)。
 * Patch 六步为骨架(Phase 5 实装远程 Bundle 版本检查);GameLauncherState 后继
 * (HotfixLauncher.main 三步)在 Phase 5 接线。
 */
@ccclass("ApplicationStartupEntry")
export default class ApplicationStartupEntry extends Component {
    @property({ type: Node, tooltip: "UI 根节点(通常为 Canvas)" })
    public uiRoot: Node | null = null;

    protected async start(): Promise<void> {
        reportStage("start.entry", "");
        try {
            if (!this.uiRoot) {
                Log.error("Startup", "uiRoot 未配置(Canvas)");
                return;
            }
            reportStage("uiRoot", String(this.uiRoot?.name ?? "null"));
            GameApp.bootstrap({ settingStorage: new CocosSettingStorage(), formHelper: new CocosFormHelper(this.uiRoot) });
            reportStage("bootstrap.done", "");

            // 协议注册:静态 bundle 注入 + 全量消息注册 + R7 自检
            ProtoMessageHelper.init($root as Record<string, unknown>);
            ProtoMessageRegister.register();
            reportStage("proto.registered", String(ProtoMessageHelper.registeredCount));
            const registered = ProtoMessageHelper.registeredCount;
            if (registered !== EXPECTED_MESSAGE_COUNT) {
                Log.warn("Startup", `消息注册自检:注册 ${registered} 项,期望 ${EXPECTED_MESSAGE_COUNT}(proto 源与生成物可能不同步)`);
            } else {
                Log.info("Startup", `消息注册自检通过:${registered} 项`);
            }

            // 11 步启动链(spec §3.4 同名同序)
            GameApp.Procedure.Initialize(GameApp.Fsm, createStartupProcedures());
            GameApp.Procedure.StartProcedure(ProcedureLauncherState);
            reportStage("procedure.started", GameApp.Procedure.CurrentProcedure?.constructor.name ?? "?");

            // 运行时启动自检落盘(QA/自动化可经 wx.getStorageSync("gfx_startup") 读取;R7 证据链)
            // 小游戏环境:启动自检落盘(QA/自动化经 wx.getStorageSync("gfx_startup") 读取)
            const globals = globalThis as Record<string, unknown>;
            const wxApi = globals.wx as { setStorageSync(key: string, value: unknown): void } | undefined;
            if (wxApi) {
                wxApi.setStorageSync("gfx_startup", { version: FRAMEWORK_VERSION, registered, ts: Date.now() });
            }
        } catch (error) {
            reportStage("start.failed", error instanceof Error ? error.message : String(error));
            Log.error("Startup", "启动链执行异常", error);
        }
    }
}

function createStartupProcedures(): ProcedureBase[] {
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
