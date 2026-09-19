import { describe, expect, it, vi } from "vitest";
import GameApp from "../../assets/gameframex/GameApp";
import ProtoMessageHelper from "../../assets/gameframex/network/ProtoMessageHelper";
import UILogin, { type ILoginView } from "../../assets/hotfix/ui/UILogin";
import type { IFormHelper } from "../../assets/gameframex/ui/IFormHelper";
import { createFakeType, feedPacket, MockSocket } from "../network/helpers";
import WebSocketChannel from "../../assets/gameframex/network/WebSocketChannel";
import NetworkModule from "../../assets/gameframex/network/NetworkModule";
import EventSystems from "../../assets/gameframex/event/EventSystems";
import { User } from "../../assets/gameframex/protobuf/_0300_User";

/** 14 字节头响应帧(JSON body,fake type 编解码) */
function buildResp(messageId: number, uniqueId: number, body: Record<string, unknown>): Uint8Array {
    const bodyBytes = new TextEncoder().encode(JSON.stringify(body));
    const frame = new Uint8Array(14 + bodyBytes.length);
    const view = new DataView(frame.buffer);
    view.setUint32(0, frame.length, false);
    frame[4] = 0;
    frame[5] = 0;
    view.setInt32(6, uniqueId, false);
    view.setInt32(10, messageId, false);
    frame.set(bodyBytes, 14);
    return frame;
}

/** UILogin 专用 FormHelper 替身(load 即返回新 UILogin,无视觉) */
function createLoginFormHelper(): IFormHelper {
    return {
        registerForm: () => {},
        load: () => Promise.resolve(new UILogin()),
        instantiate: () => {},
        addToGroup: () => {},
        release: () => {},
    };
}

class MockLoginView implements ILoginView {
    public status = "";
    public handler: (() => void) | null = null;
    public setStatus(text: string): void {
        this.status = text;
    }
    public onLoginButton(cb: () => void): void {
        this.handler = cb;
    }
}

/**
 * UILogin 全链路(mock socket):点击 → 连接 → ReqLogin → ReqPlayerList → 状态文案。
 */
describe("UILogin 登录链路", () => {
    it("点击登录:自动连接并完成两级 RPC,状态展示角色数", async () => {
        ProtoMessageHelper.reset();
        const fake = createFakeType();
        ProtoMessageHelper.init({ User: { ReqLogin: fake, RespLogin: fake, ReqPlayerList: fake, RespPlayerList: fake } });
        User.ReqLogin.register();
        User.RespLogin.register();
        User.ReqPlayerList.register();
        User.RespPlayerList.register();

        const sockets: MockSocket[] = [];
        const events = new EventSystems();
        const channel = new WebSocketChannel({
            events,
            socketFactory: (): MockSocket => {
                const socket = new MockSocket();
                sockets.push(socket);
                return socket;
            },
        });
        const module = new NetworkModule({ channel, events });

        const view = new MockLoginView();
        UILogin.viewResolver = () => view;

        GameApp.bootstrap({
            settingStorage: new Map() as never,
            formHelper: createLoginFormHelper(),
            events,
            networkModule: module,
        });

        const form = await GameApp.UI.OpenAsync<UILogin>("UILogin");
        expect(view.handler).not.toBeNull();

        // 点击登录(异步链,不 await 完整)
        const loginPromise = Promise.resolve(view.handler!());

        // 连接尚未建立 → 应发起 connect;喂 open
        await vi.waitFor(() => expect(sockets.length).toBe(1));
        sockets[0].onopen?.();
        await vi.waitFor(() => expect(view.status).toContain("登录中"));

        // 喂 RespLogin(uniqueId 从发出的 ReqLogin 帧读取)
        const sent = new Uint8Array(sockets[0].sent[0]);
        const sentView = new DataView(sent.buffer);
        const loginUnique = sentView.getInt32(6, false);
        feedPacket(sockets[0], buildResp(19660811, loginUnique, { Code: 0, Id: 7 }));
        await vi.waitFor(() => expect(view.status).toContain("角色列表"));

        const listUnique = (() => {
            const s2 = new Uint8Array(sockets[0].sent[1]);
            return new DataView(s2.buffer).getInt32(6, false);
        })();
        feedPacket(sockets[0], buildResp(19660815, listUnique, { ErrorCode: 0, PlayerList: [{ Id: 1 }, { Id: 2 }] }));

        await loginPromise;
        expect(view.status).toContain("登录成功(7)");
        expect(view.status).toContain("角色 2 个");
        GameApp.shutdownAll();
        UILogin.viewResolver = null;
    });

    it("登录失败码展示(Code>0 不进入角色列表)", async () => {
        ProtoMessageHelper.reset();
        const fake = createFakeType();
        ProtoMessageHelper.init({ User: { ReqLogin: fake, RespLogin: fake } });
        User.ReqLogin.register();
        User.RespLogin.register();

        const sockets: MockSocket[] = [];
        const events = new EventSystems();
        const channel = new WebSocketChannel({ events, socketFactory: (): MockSocket => { const s = new MockSocket(); sockets.push(s); return s; } });
        const module = new NetworkModule({ channel, events });

        const view = new MockLoginView();
        UILogin.viewResolver = () => view;
        GameApp.bootstrap({
            settingStorage: new Map() as never,
            formHelper: createLoginFormHelper(),
            events,
            networkModule: module,
        });

        await GameApp.UI.OpenAsync<UILogin>("UILogin");
        const loginPromise = Promise.resolve(view.handler!());
        sockets[0].onopen?.();
        await vi.waitFor(() => expect(sockets[0].sent.length).toBeGreaterThanOrEqual(1));
        const sent = new Uint8Array(sockets[0].sent[0]);
        const unique = new DataView(sent.buffer).getInt32(6, false);
        feedPacket(sockets[0], buildResp(19660811, unique, { Code: 1001, Id: 0 }));
        await loginPromise;
        await vi.waitFor(() => expect(view.status).toContain("登录失败:错误码 1001"));
        GameApp.shutdownAll();
        UILogin.viewResolver = null;
    });
});
