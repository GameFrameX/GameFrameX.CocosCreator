import UIForm from "../../assets/gameframex/ui/UIForm";
import type { IFormHelper } from "../../assets/gameframex/ui/IFormHelper";

/**
 * 测试支撑:记录生命周期触发序的窗体 + Mock 后端插槽。
 * 引擎无关核心的全部断言不依赖任何引擎 API 与计时器。
 */

/** 记录全部生命周期回调的测试窗体 */
export class RecordingForm extends UIForm {
    public readonly calls: string[] = [];
    public readonly receivedUserData: unknown[] = [];
    public readonly closeArgs: Array<{ isShutdown: boolean; userData: unknown }> = [];

    public OnAwake(): void {
        this.calls.push("OnAwake");
    }

    public OnInit(): void {
        this.calls.push("OnInit");
    }

    public OnOpen(userData: unknown): void {
        super.OnOpen(userData);
        this.calls.push("OnOpen");
        this.receivedUserData.push(userData);
    }

    public BindEvent(): void {
        this.calls.push("BindEvent");
    }

    public LoadData(): void {
        this.calls.push("LoadData");
    }

    public UpdateLocalization(): void {
        this.calls.push("UpdateLocalization");
    }

    public OnClose(isShutdown: boolean, userData: unknown): void {
        super.OnClose(isShutdown, userData);
        this.calls.push("OnClose");
        this.closeArgs.push({ isShutdown, userData });
    }

    public OnPause(): void {
        super.OnPause();
        this.calls.push("OnPause");
    }

    public OnResume(): void {
        super.OnResume();
        this.calls.push("OnResume");
    }

    public OnCover(): void {
        this.calls.push("OnCover");
    }

    public OnReveal(): void {
        this.calls.push("OnReveal");
    }

    public OnRefocus(userData: unknown): void {
        this.calls.push("OnRefocus");
        this.receivedUserData.push(userData);
    }

    public OnUpdate(elapseSeconds: number, realElapseSeconds: number): void {
        this.calls.push(`OnUpdate:${elapseSeconds}:${realElapseSeconds}`);
    }
}

/** 打开时暂停被覆盖界面的测试窗体(对应 Unity PauseCoveredUIForm) */
export class PauseCoverForm extends RecordingForm {
    protected _pauseCoveredUIForm: boolean = true;
}

/** 归属 Popup 组的测试窗体 */
export class PopupForm extends RecordingForm {
    protected _groupName: string = "Popup";
}

/** Mock 后端插槽:记录调用序;factory 决定 formKey → 窗体实例 */
export class MockFormHelper implements IFormHelper {
    public readonly calls: string[] = [];
    public readonly released: UIForm[] = [];
    public readonly groupAssignments: Array<{ formKey: string; groupName: string }> = [];
    public readonly factories = new Map<string, () => UIForm>();
    private _loadGate: Promise<void> | null = null;
    private _gateResolve: (() => void) | null = null;

    public register(formKey: string, factory: () => UIForm): void {
        this.factories.set(formKey, factory);
    }

    /** 设置加载闸门:下一次 load 会等待 releaseLoadGate(测并发打开;不用计时器) */
    public holdLoad(): void {
        this._loadGate = new Promise<void>((resolve) => {
            this._gateResolve = resolve;
        });
    }

    public releaseLoadGate(): void {
        this._gateResolve?.();
        this._loadGate = null;
        this._gateResolve = null;
    }

    public async load(formKey: string): Promise<UIForm> {
        this.calls.push(`load:${formKey}`);
        const factory = this.factories.get(formKey);
        if (!factory) {
            throw new Error(`[MockFormHelper] 未注册的 formKey: ${formKey}`);
        }
        if (this._loadGate) {
            await this._loadGate;
        }
        return factory();
    }

    public instantiate(form: UIForm): void {
        this.calls.push("instantiate");
    }

    public addToGroup(form: UIForm, groupName: string): void {
        this.calls.push(`addToGroup:${groupName}`);
        this.groupAssignments.push({ formKey: form.UIFormAssetName, groupName });
    }

    public release(form: UIForm): void {
        this.calls.push("release");
        this.released.push(form);
    }

    public get loadCount(): number {
        return this.calls.filter((call) => call.startsWith("load:")).length;
    }
}
