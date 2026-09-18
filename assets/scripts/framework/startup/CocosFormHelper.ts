import { AssetManager, assetManager, instantiate, Node, Prefab } from "cc";
import type UIForm from "../../../gameframex/ui/UIForm";
import type { IFormHelper } from "../../../gameframex/ui/IFormHelper";
import { UIGroupNameConstants } from "../../../gameframex/ui/UIGroup";

/** 界面注册项:formKey → 逻辑类 + 资源定位(bundle 名 + Prefab 路径) */
interface FormRegistration {
    /** 逻辑类(业务侧 UIForm 子类,如 UILogin) */
    ctor: new () => UIForm;
    /** 所在 Bundle 名(builtin/remote/…) */
    bundle: string;
    /** Bundle 内 Prefab 路径 */
    prefabPath: string;
}

/** 组名 → 容器深度(容器在 UI 根下的 sibling 序,数值大者在上) */
const GROUP_DEPTH: Record<string, number> = {
    [UIGroupNameConstants.Normal]: 0,
    [UIGroupNameConstants.Popup]: 1,
    [UIGroupNameConstants.Fixed]: 2,
};

/**
 * Cocos 原生 UI 后端(IFormHelper 的主轨实现;spec §3.1 引擎绑定边界)。
 *
 * 契约:
 * - 业务侧先 `registerForm(formKey, ctor, bundle, prefabPath)` 登记界面;未登记的 formKey 抛错。
 * - load(formKey):按需加载 Bundle 与 Prefab 并构造逻辑实例(视觉绑定推迟到 instantiate)。
 * - instantiate:instantiate Prefab 得到节点,与逻辑实例建立关联(WeakMap,核心层零引擎依赖)。
 * - addToGroup:按组深度在 UI 根下懒创建组容器并挂入(组间层级=深度,组内层级由 UIManager 栈序维护)。
 * - release:销毁节点并释放 Prefab 引用(对象池复用留后续批次)。
 */
export default class CocosFormHelper implements IFormHelper {
    private readonly _root: Node;
    private readonly _registrations: Map<string, FormRegistration> = new Map();
    private readonly _bundles: Map<string, AssetManager.Bundle> = new Map();
    private readonly _prefabs: Map<string, Prefab> = new Map();
    private readonly _visuals: WeakMap<UIForm, Node> = new WeakMap();
    /** load 时绑定的 formKey(instantiate/release 按 key 取 Prefab) */
    private readonly _formKeys: WeakMap<UIForm, string> = new WeakMap();
    private readonly _groupNodes: Map<string, Node> = new Map();

    /**
     * @param root UI 根节点(通常为 Canvas;组容器按深度挂在其下)
     */
    constructor(root: Node) {
        this._root = root;
    }

    /**
     * 登记界面(业务启动时批量调用;重复登记同一 formKey 抛错)。
     */
    public registerForm(formKey: string, ctor: new () => UIForm, bundle: string, prefabPath: string): void {
        if (this._registrations.has(formKey)) {
            throw new Error(`[CocosFormHelper] 界面重复注册: ${formKey}`);
        }
        this._registrations.set(formKey, { ctor, bundle, prefabPath });
    }

    /** 供测试与诊断:取界面视觉节点 */
    public getVisual(form: UIForm): Node | null {
        return this._visuals.get(form) ?? null;
    }

    public async load(formKey: string): Promise<UIForm> {
        const registration = this._registrations.get(formKey);
        if (!registration) {
            throw new Error(`[CocosFormHelper] 界面未注册: ${formKey}(请先 registerForm)`);
        }
        await this.ensureBundle(registration.bundle);
        if (!this._prefabs.has(formKey)) {
            const bundle = this._bundles.get(registration.bundle)!;
            const prefab = await new Promise<Prefab>((resolve, reject) => {
                bundle.load(registration.prefabPath, Prefab, (err, asset) => {
                    if (err || !asset) {
                        reject(new Error(`[CocosFormHelper] Prefab 加载失败: ${registration.bundle}/${registration.prefabPath}(${err?.message ?? "no asset"})`));
                        return;
                    }
                    resolve(asset);
                });
            });
            this._prefabs.set(formKey, prefab);
        }
        const instance = new registration.ctor();
        this._formKeys.set(instance, formKey);
        return instance;
    }

    public instantiate(form: UIForm): void {
        const formKey = this.requireFormKey(form);
        const prefab = this._prefabs.get(formKey);
        if (!prefab) {
            throw new Error("[CocosFormHelper] instantiate 时 Prefab 未加载(load 未完成?)");
        }
        const node = instantiate(prefab);
        node.active = false;
        this._visuals.set(form, node);
    }

    public addToGroup(form: UIForm, groupName: string): void {
        const node = this.requireVisual(form);
        const container = this.ensureGroupNode(groupName);
        if (node.parent !== container) {
            container.addChild(node);
        }
        node.active = true;
    }

    public release(form: UIForm): void {
        const node = this._visuals.get(form);
        if (node) {
            node.destroy();
            this._visuals.delete(form);
        }
    }

    private async ensureBundle(bundleName: string): Promise<void> {
        if (this._bundles.has(bundleName)) {
            return;
        }
        const bundle = await new Promise<AssetManager.Bundle>((resolve, reject) => {
            assetManager.loadBundle(bundleName, (err, loaded) => {
                if (err || !loaded) {
                    reject(new Error(`[CocosFormHelper] Bundle 加载失败: ${bundleName}(${err?.message ?? "no bundle"})`));
                    return;
                }
                resolve(loaded);
            });
        });
        this._bundles.set(bundleName, bundle);
    }

    private ensureGroupNode(groupName: string): Node {
        let container = this._groupNodes.get(groupName);
        if (container) {
            return container;
        }
        container = new Node(`UIGroup_${groupName}`);
        const depth = GROUP_DEPTH[groupName] ?? 0;
        this._root.addChild(container);
        container.setSiblingIndex(depth);
        this._groupNodes.set(groupName, container);
        return container;
    }

    private requireFormKey(form: UIForm): string {
        const key = this._formKeys.get(form);
        if (!key) {
            throw new Error("[CocosFormHelper] 界面未经过 load 绑定(调用序错误)");
        }
        return key;
    }

    private requireVisual(form: UIForm): Node {
        const node = this._visuals.get(form);
        if (!node) {
            throw new Error("[CocosFormHelper] 界面尚未 instantiate 即挂组(调用序错误)");
        }
        return node;
    }


}
