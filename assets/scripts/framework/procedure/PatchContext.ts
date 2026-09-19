import EventName from "../../../gameframex/event/EventName";
import Log from "../../../gameframex/base/Log";
import EventSystems from "../../../gameframex/event/EventSystems";
import type { PatchManifest, VersionStore } from "../../../gameframex/download/PatchPlanner";
import type { IPatchService } from "../../../gameframex/download/IPatchService";

/**
 * Patch 六步共享上下文(启动层经 BlackBoard 注入;spec §3.4)。
 */
export interface PatchContext {
    /** 远程清单 URL(UpdateStaticVersion 拉取) */
    manifestUrl: string;
    /** 远程 Bundle CDN 基址(DownloadWebFiles 加载) */
    server: string;
    /** 参与版本检查的远程 bundle 名单 */
    bundleNames: string[];
    /** 本地版本记录 */
    store: VersionStore;
    /** 引擎服务实现(manifest 拉取/远程 Bundle 加载) */
    service: IPatchService;
    /** 共享事件池(进度事件派发) */
    events: EventSystems;
}

/** BlackBoard key:PatchContext */
export const PATCH_CONTEXT_KEY = "__patch_context__";

/** BlackBoard key:UpdateStaticVersion 阶段拉取到的清单(UpdateManifest/DownloadWebFiles 复用) */
export const PATCH_MANIFEST_KEY = "__patch_manifest__";

/**
 * Patch 六步公共辅助:读上下文/暂存清单/派发进度。
 * 六个流程状态共享(同名同序对照 Unity Patch 段;实现替换为远程 Bundle 语义)。
 */
export function getPatchContext(fsm: { GetData<T>(name: string): T | null }): PatchContext | null {
    return fsm.GetData<PatchContext>(PATCH_CONTEXT_KEY);
}

export function setPatchManifest(fsm: { SetData(name: string, data: unknown): void }, manifest: PatchManifest): void {
    fsm.SetData(PATCH_MANIFEST_KEY, manifest);
}

export function getPatchManifest(fsm: { GetData<T>(name: string): T | null }): PatchManifest {
    const manifest = fsm.GetData<PatchManifest>(PATCH_MANIFEST_KEY);
    if (!manifest) {
        throw new Error("[Patch] 清单尚未拉取(UpdateStaticVersion 未执行)");
    }
    return manifest;
}

export function emitPatchProgress(events: EventSystems, stage: string, progress: number): void {
    events.emit(EventName.PatchProgress, { stage, progress });
}

export function logPatch(stage: string, message: string): void {
    Log.info("Patch", `[${stage}] ${message}`);
}

