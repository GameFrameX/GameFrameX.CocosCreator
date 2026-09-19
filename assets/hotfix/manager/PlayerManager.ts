/**
 * 玩家管理器(对照 Unity Hotfix/Manager/PlayerManager 同名职责,引擎无关)。
 *
 * 契约:缓存当前登录玩家的信息(ReqPlayerLogin/RespPlayerCreate 返回)。
 */
import Singleton from "../../gameframex/base/Singleton";
import type { PlayerInfoLite } from "./AccountManager";

export default class PlayerManager extends Singleton<PlayerManager>() {
    /** 当前玩家信息;未登录为 null */
    public PlayerInfo: PlayerInfoLite | null = null;
}
