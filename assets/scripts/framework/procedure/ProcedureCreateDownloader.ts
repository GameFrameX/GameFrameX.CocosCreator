import Log from "../../../gameframex/base/Log";
import type IFsm from "../../../gameframex/fsm/IFsm";
import type IProcedureManager from "../../../gameframex/procedure/IProcedureManager";
import ProcedureBase from "../../../gameframex/procedure/ProcedureBase";
import { appendStartupTrace } from "./BlackBoardKeys";
import ProcedureDownloadWebFiles from "./ProcedureDownloadWebFiles";
import { emitPatchProgress, getPatchContext, logPatch } from "./PatchContext";

/**
 * ProcedureCreateDownloader(Patch 六步第 4 步;spec §3.4)。准备下载通道(对照 Unity 段名;Cocos 差异下载由 Bundle md5 内建)。
 */
export default class ProcedureCreateDownloader extends ProcedureBase {
    public OnEnter(fsm: IFsm<IProcedureManager>): void {
        appendStartupTrace(fsm, this);
        const context = getPatchContext(fsm);
        if (!context) {
            Log.warn("Patch", "未注入 PatchContext,Patch 段跳过(未配置远程更新)");
            this.ChangeState(fsm, ProcedureDownloadWebFiles);
            return;
        }
        logPatch("CreateDownloader", "下载器就绪(引擎 assetManager.downloader 语义)");
        emitPatchProgress(context.events, "CreateDownloader", 1);
        this.ChangeState(fsm, ProcedureDownloadWebFiles);
    }
}
