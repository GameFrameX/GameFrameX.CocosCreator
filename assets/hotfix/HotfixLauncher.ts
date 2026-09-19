import GameApp from "../gameframex/GameApp";
import Log from "../gameframex/base/Log";
import type { TableLoader } from "../gameframex/config/ConfigModule";
import ProtoMessageHelper from "../gameframex/network/ProtoMessageHelper";
import ProtoMessageRegister from "../gameframex/protobuf/ProtoMessageRegister";
import { TablesComponent } from "./config/luban/schema";
import { Local } from "./config/luban/schema";

/**
 * 热更层启动器(对照 Unity Assets/Hotfix/HotfixLauncher;spec §3.4 三步)。
 *
 * 契约:作为 ProcedureGameLauncherState 的后继被调用——
 * 1. 注册协议(幂等:重复注册被 ProtoMessageHelper 拦截并告警);
 * 2. LoadConfig:以注入 loader 灌注 luban 全表并回填本地化(引擎侧 loader 由启动层准备,
 *    测试侧为 fs 读取;表集构造固定为 luban TablesComponent);
 * 3. OpenAsync UILogin(界面注册由 Phase 3/6 落地;未就绪时告警不阻断启动链)。
 */
export default class HotfixLauncher {
    /**
     * 热更层入口。
     * @param loader 表名 → JSON 数据(引擎侧:base Bundle 预载后的同步查表)
     */
    public static async main(loader: TableLoader): Promise<void> {
        // 1) 注册协议(编辑器启动链已注册;此处幂等兜底)
        if (ProtoMessageHelper.registeredCount === 0) {
            ProtoMessageRegister.register();
        }
        Log.info("Hotfix", `协议注册:${ProtoMessageHelper.registeredCount} 项`);

        // 2) LoadConfig + 本地化灌注 + TranslateText 回填
        await GameApp.Config.loadAsync(loader, (l) => new TablesComponent(l as (name: string) => never));
        const tbLocalization = GameApp.Config.GetConfig<Local.TbLocalization>("TbLocalization");
        GameApp.Localization.loadFromTbLocalization(tbLocalization.getDataList() as ReadonlyArray<{ key: string }>);
        GameApp.Localization.setLanguage(GameApp.Localization.DefaultLanguage);
        Log.info("Hotfix", `配置加载完成,本地化灌注 ${GameApp.Localization.DictionaryCount} 条`);

        // 3) 打开登录界面(UILogin 注册由 Phase 3/6 落地;未就绪仅告警)
        try {
            await GameApp.UI.OpenAsync("UILogin");
        } catch (error) {
            Log.warn("Hotfix", "UILogin 打开跳过", error);
        }
    }
}
