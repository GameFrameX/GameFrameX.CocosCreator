import type { IModule } from "../GameEntry";
import Log from "../base/Log";
import type { IFormHelper } from "./IFormHelper";
import UIForm from "./UIForm";
import UIGroup, { UIGroupNameConstants } from "./UIGroup";

/**
 * 界面过渡插槽(动画/过渡接入点,编辑器阶段实现;接口默认空实现 NoneUIFormTransition)。
 */
export interface IUIFormTransition {
    /** 打开序列末尾、组刷新前的显示过渡(默认空实现) */
    show(form: UIForm): void;
    /** 关闭流程中出栈之后、OnClose 之前的隐藏过渡(默认空实现;异步过渡的延迟关闭由编辑器阶段扩展) */
    hide(form: UIForm): void;
}

/** 默认过渡插槽:无任何过渡(立即完成) */
export class NoneUIFormTransition implements IUIFormTransition {
    public show(form: UIForm): void {
    }

    public hide(form: UIForm): void {
    }
}

/**
 * 界面管理器(引擎无关,implements IModule;对照 Unity `UIComponent`/`BaseUIManager`)。
 *
 * 契约:
 * - `OpenAsync(formKey, userData)`:同 formKey 单例——已打开则返回既有实例并仅触发 OnRefocus,
 *   不重复 OnAwake/OnOpen/BindEvent;并发打开共享同一次加载;
 * - 打开序列(与 Unity InternalOpenUIForm 一致):
 *   helper.load → internalInit/OnInit → OnAwake → helper.instantiate → helper.addToGroup →
 *   组入栈 → OnOpen → BindEvent → LoadData → UpdateLocalization → 过渡 show → 组 Refresh;
 * - `Close(formKey 或实例)`:出栈(OnCover→OnPause)→ 过渡 hide → OnClose → 组 Refresh(揭示下层)→
 *   helper.release;重复关闭幂等(告警后忽略);
 * - `Toggle`:开→关/关→开,返回操作后的开关状态;
 * - 关闭/遮挡语义由 UIGroup 统一驱动(见 UIGroup 契约);
 * - 通过 GameEntry 注册后由 `update(dt)` 帧驱动未暂停界面的 OnUpdate。
 */
export default class UIManager implements IModule {
    private readonly _formHelper: IFormHelper;
    private readonly _uiGroups: Map<string, UIGroup> = new Map<string, UIGroup>();
    /** 已打开界面:formKey → 实例(同 formKey 单例) */
    private readonly _uiForms: Map<string, UIForm> = new Map<string, UIForm>();
    /** 加载中的界面:formKey → 共享加载任务 */
    private readonly _loadingForms: Map<string, Promise<UIForm>> = new Map<string, Promise<UIForm>>();
    private _serial: number = 0;
    private _isShutdown: boolean = false;
    private _transition: IUIFormTransition = new NoneUIFormTransition();

    /**
     * @param formHelper 界面后端插槽(CocosFormHelper 主轨 / FairyGUIFormHelper 可选轨)
     */
    constructor(formHelper: IFormHelper) {
        this._formHelper = formHelper;
    }

    /**
     * 注册默认界面组 Normal(0)/Popup(1)/Fixed(2);幂等(已存在的组不重建)。
     */
    public async init(): Promise<void> {
        this._isShutdown = false;
        this.AddUIGroup(UIGroupNameConstants.Normal, UIGroupNameConstants.NormalDepth);
        this.AddUIGroup(UIGroupNameConstants.Popup, UIGroupNameConstants.PopupDepth);
        this.AddUIGroup(UIGroupNameConstants.Fixed, UIGroupNameConstants.FixedDepth);
    }

    /**
     * 帧驱动:各组自栈顶向下轮询未暂停界面(elapse/realElapse 均传 dt,单时钟语义)。
     */
    public update(dt: number): void {
        for (const group of this._uiGroups.values()) {
            group.Update(dt, dt);
        }
    }

    /**
     * 整体关闭:以 isShutdown=true 关闭全部已加载界面并清空组与加载任务。
     */
    public shutdown(): void {
        this._isShutdown = true;
        this.CloseAllLoadedUIForms();
        this._uiGroups.clear();
        this._loadingForms.clear();
    }

    /**
     * 登记界面(透传至 FormHelper 后端;业务启动时批量调用)。
     */
    public RegisterForm(formKey: string, ctor: new () => UIForm, bundle: string, assetPath: string): void {
        this._formHelper.registerForm(formKey, ctor, bundle, assetPath);
    }

    /**
     * 异步打开界面(同 formKey 已打开则返回既有实例并仅触发 OnRefocus,不重复生命周期;
     * 并发打开共享同一次后端加载)。
     *
     * @param formKey  界面资源名(后端插槽以此定位 Prefab/FairyGUI 包)
     * @param userData 传递给 OnOpen/OnRefocus 的用户自定义数据
     */
    public async OpenAsync<TUIForm extends UIForm = UIForm>(formKey: string, userData?: unknown): Promise<TUIForm> {
        const existing = this._uiForms.get(formKey);
        if (existing) {
            this.RefocusUIForm(existing, userData);
            return existing as TUIForm;
        }
        const loading = this._loadingForms.get(formKey);
        if (loading) {
            return (await loading) as TUIForm;
        }
        const task = this.loadAndOpen(formKey, userData);
        this._loadingForms.set(formKey, task);
        try {
            return (await task) as TUIForm;
        } finally {
            this._loadingForms.delete(formKey);
        }
    }

    /**
     * 关闭界面(按 formKey 或实例;已关闭/不存在则告警忽略,不重复 OnClose 与后端释放)。
     */
    public Close(formKeyOrForm: string | UIForm, userData?: unknown): void {
        let form: UIForm | null = null;
        if (typeof formKeyOrForm === "string") {
            form = this._uiForms.get(formKeyOrForm) ?? null;
        } else if (this._uiForms.get(formKeyOrForm.UIFormAssetName) === formKeyOrForm) {
            form = formKeyOrForm;
        }
        if (!form) {
            const key = typeof formKeyOrForm === "string" ? formKeyOrForm : formKeyOrForm.UIFormAssetName;
            Log.error("UIManager", `要关闭的界面不存在或已关闭: '${key}'`);
            return;
        }
        const group = form.UIGroup;
        if (!group) {
            Log.error("UIManager", `界面 '${form.UIFormAssetName}' 未挂接界面组,无法关闭`);
            return;
        }
        group.RemoveUIForm(form);
        this._uiForms.delete(form.UIFormAssetName);
        this._transition.hide(form);
        form.internalClose(this._isShutdown, userData ?? null);
        group.Refresh();
        this._formHelper.release(form);
        form.UIGroup = null;
    }

    /**
     * 开关切换:已打开则关闭返回 false,未打开则打开返回 true。
     */
    public async Toggle(formKey: string, userData?: unknown): Promise<boolean> {
        if (this._uiForms.has(formKey)) {
            this.Close(formKey, userData);
            return false;
        }
        await this.OpenAsync(formKey, userData);
        return true;
    }

    /**
     * 激活界面:移回组内栈顶并触发一次 OnRefocus(重复打开已开启 formKey 时的默认路径)。
     */
    public RefocusUIForm(form: UIForm, userData?: unknown): void {
        const group = form.UIGroup;
        if (!group) {
            Log.error("UIManager", `界面 '${form.UIFormAssetName}' 未挂接界面组,无法激活`);
            return;
        }
        group.RefocusUIForm(form);
        group.Refresh();
        form.OnRefocus(userData ?? null);
    }

    /** 取已加载界面(无则 null) */
    public GetUIForm(formKey: string): UIForm | null {
        return this._uiForms.get(formKey) ?? null;
    }

    /** 是否存在已加载界面 */
    public HasUIForm(formKey: string): boolean {
        return this._uiForms.has(formKey);
    }

    /** 取全部已加载界面(打开顺序) */
    public GetAllLoadedUIForms(): UIForm[] {
        return Array.from(this._uiForms.values());
    }

    /** 关闭全部已加载界面 */
    public CloseAllLoadedUIForms(userData?: unknown): void {
        for (const form of Array.from(this._uiForms.values())) {
            this.Close(form, userData);
        }
    }

    /**
     * 增加界面组;同名已存在返回 false。
     */
    public AddUIGroup(uiGroupName: string, depth: number = 0): boolean {
        if (uiGroupName.length === 0) {
            throw new Error("[UIManager] 界面组名称不能为空");
        }
        if (this._uiGroups.has(uiGroupName)) {
            return false;
        }
        this._uiGroups.set(uiGroupName, new UIGroup(uiGroupName, depth));
        return true;
    }

    /** 是否存在界面组 */
    public HasUIGroup(uiGroupName: string): boolean {
        return this._uiGroups.has(uiGroupName);
    }

    /** 取界面组(无则 null) */
    public GetUIGroup(uiGroupName: string): UIGroup | null {
        return this._uiGroups.get(uiGroupName) ?? null;
    }

    /** 取全部界面组 */
    public GetAllUIGroups(): UIGroup[] {
        return Array.from(this._uiGroups.values());
    }

    /** 界面组数量 */
    public get UIGroupCount(): number {
        return this._uiGroups.size;
    }

    /**
     * 关闭指定界面组内的全部界面(组保留)。
     */
    public CloseUIGroup(uiGroupName: string, userData?: unknown): void {
        const group = this._uiGroups.get(uiGroupName);
        if (!group) {
            Log.error("UIManager", `界面组 '${uiGroupName}' 不存在`);
            return;
        }
        for (const form of group.GetAllUIForms()) {
            this.Close(form, userData);
        }
    }

    /**
     * 设置过渡插槽(动画/过渡;传 null 为编程错误)。
     */
    public SetTransition(transition: IUIFormTransition): void {
        if (!transition) {
            throw new Error("[UIManager] 过渡插槽不能为空");
        }
        this._transition = transition;
    }

    /**
     * 加载并按打开序列装配界面(OpenAsync 的共享任务体)。
     */
    private async loadAndOpen(formKey: string, userData: unknown): Promise<UIForm> {
        const form = await this._formHelper.load(formKey);
        if (this._isShutdown) {
            this._formHelper.release(form);
            return form;
        }
        form.internalAwake();
        form.internalInit(++this._serial, formKey);
        const group = this.ensureGroup(form.GroupName);
        this._formHelper.instantiate(form);
        this._formHelper.addToGroup(form, group.Name);
        form.UIGroup = group;
        group.AddUIForm(form);
        this._uiForms.set(formKey, form);
        form.internalOpen(userData ?? null);
        this._transition.show(form);
        group.Refresh();
        return form;
    }

    /**
     * 取界面组,不存在则按递增深度自动创建。
     */
    private ensureGroup(groupName: string): UIGroup {
        const group = this._uiGroups.get(groupName);
        if (group) {
            return group;
        }
        const created = new UIGroup(groupName, this._uiGroups.size);
        this._uiGroups.set(groupName, created);
        return created;
    }
}
