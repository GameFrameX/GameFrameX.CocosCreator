import type UIGroup from "./UIGroup";

/**
 * 界面接口(对照 Unity GameFrameX `IUIForm`,方法同名同参;C# `object` 参数映射为 `unknown`)。
 *
 * 生命周期时序契约(由 UIManager 统一驱动,业务子类只覆写、不主动调用):
 * 1. 创建一次:`OnAwake`(实例身份就绪前,禁止访问 SerialId/UIGroup)→ `OnInit`(formKey/SerialId 就绪后);
 * 2. 每次打开:`OnOpen(userData)` → `BindEvent`(每个开关周期至多一次)→ `LoadData` → `UpdateLocalization`;
 * 3. 遮挡:被更新的界面覆盖 → `OnCover`;若覆盖者声明 `PauseCoveredUIForm` 则再叠加 `OnPause`;
 * 4. 恢复:覆盖者关闭/失焦 → `OnResume`(曾被暂停时)→ `OnReveal`;
 * 5. 关闭:`OnClose(isShutdown, userData)`,之后实例交还后端插槽释放。
 */
export interface IUIForm {
    /** 界面序列编号(管理器分配,单调递增) */
    readonly SerialId: number;
    /** 界面完整名称(逻辑类名,对应 Unity GetType().FullName) */
    readonly FullName: string;
    /** 界面资源名(即打开时的 formKey,管理器以此作单例索引) */
    readonly UIFormAssetName: string;
    /** 界面当前是否可用(打开且未被暂停遮挡) */
    readonly Available: boolean;
    /** 界面当前是否可见(Available 且未被隐藏) */
    readonly Visible: boolean;
    /** 是否已执行过 OnAwake(每实例一次) */
    readonly IsAwake: boolean;
    /** 最近一次 OnOpen/OnRefocus 携带的用户自定义数据 */
    readonly UserData: unknown;
    /** 界面在界面组内的深度(组内越大越靠上层) */
    readonly DepthInUIGroup: number;
    /** 打开本界面时是否暂停被其覆盖的界面 */
    readonly PauseCoveredUIForm: boolean;
    /** 所属界面组名(对应 Unity OptionUIGroupAttribute.GroupName,决定层级分组) */
    readonly GroupName: string;
    /** 所属界面组(管理器挂接;关闭后置空) */
    UIGroup: UIGroup | null;

    /** 界面初始化前执行(实例创建一次;业务在此初始化字段与子组件引用) */
    OnAwake(): void;
    /** 界面初始化(formKey/SerialId 就绪后执行一次) */
    OnInit(): void;
    /** 界面打开(每开关周期一次;基类已记录 userData 并激活状态) */
    OnOpen(userData: unknown): void;
    /** 绑定事件(每开关周期至多一次;在 OnOpen 之后、LoadData 之前) */
    BindEvent(): void;
    /** 加载数据(每开关周期一次;在 BindEvent 之后) */
    LoadData(): void;
    /** 更新本地化文本(打开序列末尾;本地化模块接入后由语言变更再次驱动) */
    UpdateLocalization(): void;
    /** 界面关闭;isShutdown=true 表示界面管理器整体关闭时触发 */
    OnClose(isShutdown: boolean, userData: unknown): void;
    /** 界面被暂停(被声明 PauseCoveredUIForm 的界面覆盖,或界面组暂停) */
    OnPause(): void;
    /** 界面从暂停恢复(基类恢复可用与可见) */
    OnResume(): void;
    /** 界面被遮挡(组内有更新界面覆盖其上) */
    OnCover(): void;
    /** 界面遮挡恢复(覆盖它的界面关闭或失焦) */
    OnReveal(): void;
    /** 界面激活(重复打开已开启的 formKey 时触发,替代完整生命周期) */
    OnRefocus(userData: unknown): void;
    /** 界面轮询(仅未暂停界面收到;由 UIManager.update 驱动) */
    OnUpdate(elapseSeconds: number, realElapseSeconds: number): void;
    /** 界面在组内深度变化(组刷新时由界面组回调) */
    OnDepthChanged(uiGroupDepth: number, depthInUIGroup: number): void;
}
