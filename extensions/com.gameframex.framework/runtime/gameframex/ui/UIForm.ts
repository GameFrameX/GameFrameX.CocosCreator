import type { IUIForm } from "./IUIForm";
import type UIGroup from "./UIGroup";
import { UIGroupNameConstants } from "./UIGroup";
import Log from "../base/Log";

/**
 * 界面基类(引擎无关,对照 Unity `com.gameframex.unity.ui` 的 UIForm.cs,方法同名同参)。
 *
 * 生命周期时序契约(全部由 UIManager 驱动,业务子类只覆写钩子、不主动调用):
 *
 * ```
 * 创建一次:  OnAwake → OnInit(formKey/SerialId 就绪后)
 * 每次打开:  OnOpen(userData) → BindEvent → LoadData → UpdateLocalization
 * 遮挡:      OnCover(被更新界面覆盖)/ OnPause(覆盖者声明 PauseCoveredUIForm 时叠加)
 * 恢复:      OnResume → OnReveal(覆盖者关闭/失焦后)
 * 关闭:      OnCover → OnPause → OnClose(isShutdown, userData)(关闭路径先出栈标记)
 * ```
 *
 * 幂等保证(内部状态标记,对应任务要求"二次打开同实例不重复 OnAwake/BindEvent"):
 * - `OnAwake` 每实例至多一次(`internalAwake` 守卫);
 * - `BindEvent` 每个开关周期至多一次(`internalOpen` 守卫,`internalClose` 复位);
 * - `internalOpen`/`internalClose` 在已打开/未打开状态下重复驱动不重复回调。
 *
 * 引擎绑定约束:UIForm 不 import 任何引擎 API;视觉实例的创建/挂组/释放全部走 IFormHelper 插槽。
 */
export default abstract class UIForm implements IUIForm {
    /** 所属界面组名(对应 Unity OptionUIGroupAttribute.GroupName;业务子类按需覆盖) */
    protected _groupName: string = UIGroupNameConstants.Normal;
    /** 打开本界面时是否暂停被其覆盖的界面(对应 Unity pauseCoveredUIForm;业务子类按需覆盖) */
    protected _pauseCoveredUIForm: boolean = false;

    private _serialId: number = 0;
    private _formKey: string = "";
    private _fullName: string = "";
    private _available: boolean = false;
    private _visible: boolean = false;
    private _isAwake: boolean = false;
    private _isInit: boolean = false;
    private _isOpen: boolean = false;
    private _isEventBound: boolean = false;
    private _userData: unknown = null;
    private _uiGroup: UIGroup | null = null;
    private _depthInUIGroup: number = 0;

    /** 界面序列编号(管理器分配,单调递增) */
    public get SerialId(): number {
        return this._serialId;
    }

    /** 界面完整名称(逻辑类名;对应 Unity GetType().FullName,压缩构建下以构建器保留名为准) */
    public get FullName(): string {
        return this._fullName;
    }

    /** 界面资源名(打开时的 formKey,管理器以此作单例索引) */
    public get UIFormAssetName(): string {
        return this._formKey;
    }

    /** 界面当前是否可用(打开且未被暂停遮挡) */
    public get Available(): boolean {
        return this._available;
    }

    /** 界面当前是否可见(可用且未被隐藏) */
    public get Visible(): boolean {
        return this._available && this._visible;
    }

    /** 是否已执行过 OnAwake(每实例一次) */
    public get IsAwake(): boolean {
        return this._isAwake;
    }

    /** 最近一次 OnOpen/OnRefocus 携带的用户自定义数据 */
    public get UserData(): unknown {
        return this._userData;
    }

    /** 打开本界面时是否暂停被其覆盖的界面 */
    public get PauseCoveredUIForm(): boolean {
        return this._pauseCoveredUIForm;
    }

    /** 所属界面组名(决定层级分组) */
    public get GroupName(): string {
        return this._groupName;
    }

    /** 界面在界面组内的深度(组内越大越靠上层) */
    public get DepthInUIGroup(): number {
        return this._depthInUIGroup;
    }

    /** 所属界面组(管理器挂接;关闭后置空) */
    public get UIGroup(): UIGroup | null {
        return this._uiGroup;
    }

    public set UIGroup(value: UIGroup | null) {
        this._uiGroup = value;
    }

    // ── 业务生命周期钩子(Unity 同名同参;覆写时按需 super 保持基类状态语义) ──────────

    /** 界面初始化前执行(实例创建一次;此时 SerialId/UIGroup 尚未就绪,禁止访问) */
    public OnAwake(): void {
    }

    /** 界面初始化(formKey/SerialId 就绪后执行一次) */
    public OnInit(): void {
    }

    /** 界面打开(每开关周期一次;基类记录 userData 并置为可用可见) */
    public OnOpen(userData: unknown): void {
        this._userData = userData;
        this._available = true;
        this._visible = true;
    }

    /** 绑定事件(每开关周期至多一次;在 OnOpen 之后、LoadData 之前) */
    public BindEvent(): void {
    }

    /** 加载数据(每开关周期一次;在 BindEvent 之后) */
    public LoadData(): void {
    }

    /** 更新本地化文本(打开序列末尾;语言变更时由本地化模块再次驱动) */
    public UpdateLocalization(): void {
    }

    /** 界面关闭;isShutdown=true 表示界面管理器整体关闭时触发(基类置为不可用不可见) */
    public OnClose(isShutdown: boolean, userData: unknown): void {
        this._available = false;
        this._visible = false;
    }

    /** 界面被暂停(被声明 PauseCoveredUIForm 的界面覆盖,或界面组暂停;基类置为不可用不可见) */
    public OnPause(): void {
        this._available = false;
        this._visible = false;
    }

    /** 界面从暂停恢复(基类恢复可用可见) */
    public OnResume(): void {
        this._available = true;
        this._visible = true;
    }

    /** 界面被遮挡(组内有更新界面覆盖其上;视觉淡出由后端插槽处理) */
    public OnCover(): void {
    }

    /** 界面遮挡恢复(覆盖它的界面关闭或失焦) */
    public OnReveal(): void {
    }

    /** 界面激活(重复打开已开启的 formKey 时触发,替代完整生命周期) */
    public OnRefocus(userData: unknown): void {
        this._userData = userData;
    }

    /** 界面轮询(仅未暂停界面收到;由 UIManager.update 驱动) */
    public OnUpdate(elapseSeconds: number, realElapseSeconds: number): void {
    }

    /** 界面在组内深度变化(组刷新时由界面组回调) */
    public OnDepthChanged(uiGroupDepth: number, depthInUIGroup: number): void {
        this._depthInUIGroup = depthInUIGroup;
    }

    // ── 框架内部驱动(由 UIManager 调用;业务不得调用) ─────────────────────────────

    /**
     * 分配实例身份并执行 OnInit(每实例一次;对照 Unity UIForm.Init 的 m_IsInit 守卫)。
     */
    public internalInit(serialId: number, formKey: string): void {
        if (serialId >= 0) {
            this._serialId = serialId;
        }
        if (this._isInit) {
            return;
        }
        this._formKey = formKey;
        this._fullName = this.constructor.name;
        this._depthInUIGroup = 0;
        this._isInit = true;
        this.OnInit();
    }

    /**
     * 执行 OnAwake(每实例一次;对应 Unity 引擎在实例化时机触发 Awake)。
     */
    public internalAwake(): void {
        if (this._isAwake) {
            return;
        }
        this._isAwake = true;
        this.OnAwake();
    }

    /**
     * 按打开时序驱动:OnOpen → BindEvent(每开关周期一次)→ LoadData → UpdateLocalization。
     * 已处于打开态时重复驱动不重复生命周期(仅告警,正常流程由管理器单例去重)。
     */
    public internalOpen(userData: unknown): void {
        if (this._isOpen) {
            Log.warn("UIForm", `界面 '${this._formKey}' 已处于打开态,忽略重复打开驱动`);
            return;
        }
        this._isOpen = true;
        this.OnOpen(userData);
        if (!this._isEventBound) {
            this._isEventBound = true;
            this.BindEvent();
        }
        this.LoadData();
        this.UpdateLocalization();
    }

    /**
     * 驱动 OnClose(仅在打开态生效,重复关闭不重复回调;关闭后复位事件绑定标记,
     * 使实例经对象池复用的下一个打开周期能够重新 BindEvent)。
     */
    public internalClose(isShutdown: boolean, userData: unknown): void {
        if (!this._isOpen) {
            return;
        }
        this._isOpen = false;
        this._isEventBound = false;
        this.OnClose(isShutdown, userData);
    }
}
