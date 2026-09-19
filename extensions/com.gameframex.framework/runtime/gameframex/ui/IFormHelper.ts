import type UIForm from "./UIForm";

/**
 * 界面后端插槽(引擎绑定边界;对照 Unity `UIFormHelperBase` 的实例化/释放职责)。
 *
 * 架构决策(spec §3.1 / §5):Cocos 原生 UI 主轨 `CocosFormHelper`(Prefab 实例化)与
 * 可选轨 `FairyGUIFormHelper` 通过本插槽互换,业务代码零改动。
 * 核心层(UIForm 体系/UIManager)只依赖本接口,不 import 任何引擎 API。
 * 打开/关闭时的插槽调用序(由 UIManager 驱动):
 * `load(formKey)` → `instantiate(form)` → `addToGroup(form, groupName)` → … → 关闭时 `release(form)`。
 */
export interface IFormHelper {
    /**
     * 登记界面(业务启动时批量调用):formKey → 逻辑类 + 资源定位。
     * 未登记的 formKey 在 load 时由后端抛错。
     */
    registerForm(formKey: string, ctor: new () => UIForm, bundle: string, assetPath: string): void;

    /**
     * 异步加载界面定义并创建界面逻辑实例(新实例;Prefab 轨=加载 Prefab 并绑定逻辑类,
     * FairyGUI 轨=加载组件包并创建逻辑类;返回时尚未初始化,身份由管理器分配)。
     */
    load(formKey: string): Promise<UIForm>;

    /**
     * 为已加载的界面创建视觉实例并挂接到逻辑对象(对应 Unity InstantiateUIForm;
     * 在 addToGroup 之前调用)。
     */
    instantiate(form: UIForm): void;

    /**
     * 将界面视觉实例挂入指定界面组容器(组间层级由组深度决定,组内层级由入栈顺序决定;
     * 对应 Unity UIGroupHelper 的容器挂接)。
     */
    addToGroup(form: UIForm, groupName: string): void;

    /**
     * 释放界面视觉实例与资源引用(关闭流程末尾调用一次;对象池复用策略由后端实现决定)。
     */
    release(form: UIForm): void;
}
