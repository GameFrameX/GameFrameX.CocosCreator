import type UIForm from "./UIForm";
import Log from "../base/Log";

/** 组内界面条目:遮挡/暂停状态记账(对应 Unity UIFormInfo.Covered/Paused) */
interface UIFormInfo {
    form: UIForm;
    covered: boolean;
    paused: boolean;
}

/**
 * 界面组名称常量与默认深度(Normal < Popup < Fixed,深度大者整组渲染在上层)。
 * 对应 Unity `UIGroupNameConstants`;Cocos 版按 spec §3.1 收敛为三组。
 */
export class UIGroupNameConstants {
    /** 常规界面组 */
    public static readonly Normal: string = "Normal";
    /** 弹窗界面组 */
    public static readonly Popup: string = "Popup";
    /** 常驻固定界面组(顶层) */
    public static readonly Fixed: string = "Fixed";
    /** Normal 组默认深度 */
    public static readonly NormalDepth: number = 0;
    /** Popup 组默认深度 */
    public static readonly PopupDepth: number = 1;
    /** Fixed 组默认深度 */
    public static readonly FixedDepth: number = 2;
}

/**
 * 界面组(引擎无关,对照 Unity `UIGroup`)。
 *
 * 契约:
 * - 组内界面按栈维护,索引 0 为栈顶(最新打开,`DepthInUIGroup` 最大);
 * - `Refresh` 统一驱动遮挡语义:栈顶之下被覆盖 → OnCover;覆盖者声明 PauseCoveredUIForm → 之下全部 OnPause;
 *   覆盖关系解除 → OnResume(曾暂停时)→ OnReveal;
 * - `RemoveUIForm` 按 Unity 语义先对被移除界面标记 OnCover→OnPause 再出栈(隐藏动画路径可 isSkipPause);
 * - `Update` 自栈顶向下轮询,遇到首个已暂停界面即停止(被覆盖但未暂停的界面仍更新)。
 */
export default class UIGroup {
    private readonly _name: string;
    private _depth: number;
    private _pause: boolean = false;
    /** 组内界面栈:索引 0 为栈顶(最新打开,渲染在上) */
    private readonly _formInfos: UIFormInfo[] = [];

    /**
     * @param name  界面组名称(非空)
     * @param depth 界面组深度(组间层级,大者在上)
     */
    constructor(name: string, depth: number) {
        if (name.length === 0) {
            throw new Error("[UIGroup] 界面组名称不能为空");
        }
        this._name = name;
        this._depth = depth;
    }

    /** 界面组名称 */
    public get Name(): string {
        return this._name;
    }

    /** 界面组深度(变化后重刷遮挡与深度) */
    public get Depth(): number {
        return this._depth;
    }

    public set Depth(value: number) {
        if (this._depth === value) {
            return;
        }
        this._depth = value;
        this.Refresh();
    }

    /** 界面组是否整体暂停(暂停期间组内全部界面 OnCover→OnPause) */
    public get Pause(): boolean {
        return this._pause;
    }

    public set Pause(value: boolean) {
        if (this._pause === value) {
            return;
        }
        this._pause = value;
        this.Refresh();
    }

    /** 组内界面数量 */
    public get UIFormCount(): number {
        return this._formInfos.length;
    }

    /** 当前栈顶界面(最新打开) */
    public get CurrentUIForm(): UIForm | null {
        return this._formInfos[0]?.form ?? null;
    }

    /**
     * 入栈界面(置于栈顶;由管理器在打开序列中调用)。
     */
    public AddUIForm(form: UIForm): void {
        this._formInfos.unshift({ form, covered: false, paused: false });
    }

    /**
     * 出栈界面(关闭路径;Unity 语义:先对被移除界面标记 OnCover→OnPause 再出栈)。
     *
     * @param form        要移除的界面
     * @param isSkipPause 是否跳过 OnPause 回调(隐藏动画路径沿用 Unity 的跳过语义,状态仍标记为已暂停)
     */
    public RemoveUIForm(form: UIForm, isSkipPause: boolean = false): void {
        const index = this._formInfos.findIndex((info) => info.form === form);
        if (index < 0) {
            Log.error("UIGroup", `界面组 '${this._name}' 不存在界面 '${form.UIFormAssetName}'`);
            return;
        }
        const info = this._formInfos[index];
        if (!info.covered) {
            info.covered = true;
            form.OnCover();
        }
        if (!info.paused) {
            info.paused = true;
            if (!isSkipPause) {
                form.OnPause();
            }
        }
        this._formInfos.splice(index, 1);
    }

    /**
     * 将界面移回栈顶(不触发回调;OnRefocus 由管理器统一调用一次,规避 Unity 版组内/管理器重复调用的瑕疵)。
     */
    public RefocusUIForm(form: UIForm): void {
        const index = this._formInfos.findIndex((info) => info.form === form);
        if (index < 0) {
            Log.error("UIGroup", `界面组 '${this._name}' 不存在界面 '${form.UIFormAssetName}'`);
            return;
        }
        const [info] = this._formInfos.splice(index, 1);
        this._formInfos.unshift(info);
    }

    /**
     * 刷新界面组:自栈顶向栈底重算深度并驱动遮挡语义(对照 Unity UIGroup.Refresh)。
     * 栈顶界面恢复可用;声明 PauseCoveredUIForm 的界面之下全部暂停;非栈顶一律视为被覆盖。
     */
    public Refresh(): void {
        const infos = this._formInfos.slice();
        let pause = this._pause;
        let cover = false;
        let depth = infos.length;
        for (const info of infos) {
            info.form.OnDepthChanged(this._depth, depth--);
            if (pause) {
                this.tryMarkCovered(info);
                this.tryMarkPaused(info);
                continue;
            }
            this.tryResume(info);
            if (info.form.PauseCoveredUIForm) {
                pause = true;
            }
            if (cover) {
                this.tryMarkCovered(info);
            } else {
                this.tryReveal(info);
                cover = true;
            }
        }
    }

    /**
     * 组内轮询:自栈顶向下调用未暂停界面的 OnUpdate,遇首个已暂停界面停止。
     */
    public Update(elapseSeconds: number, realElapseSeconds: number): void {
        for (const info of this._formInfos.slice()) {
            if (info.paused) {
                break;
            }
            info.form.OnUpdate(elapseSeconds, realElapseSeconds);
        }
    }

    /** 组内是否存在指定资源名的界面 */
    public HasUIForm(formKey: string): boolean {
        return this._formInfos.some((info) => info.form.UIFormAssetName === formKey);
    }

    /** 取组内指定资源名的界面(无则 null) */
    public GetUIForm(formKey: string): UIForm | null {
        return this._formInfos.find((info) => info.form.UIFormAssetName === formKey)?.form ?? null;
    }

    /** 取组内全部界面(栈顶在前) */
    public GetAllUIForms(): UIForm[] {
        return this._formInfos.map((info) => info.form);
    }

    private tryMarkCovered(info: UIFormInfo): void {
        if (info.covered) {
            return;
        }
        info.covered = true;
        info.form.OnCover();
    }

    private tryMarkPaused(info: UIFormInfo): void {
        if (info.paused) {
            return;
        }
        info.paused = true;
        info.form.OnPause();
    }

    private tryResume(info: UIFormInfo): void {
        if (!info.paused) {
            return;
        }
        info.paused = false;
        info.form.OnResume();
    }

    private tryReveal(info: UIFormInfo): void {
        if (!info.covered) {
            return;
        }
        info.covered = false;
        info.form.OnReveal();
    }
}
