import GameApp from "./GameApp";
import LogHelper from "./log/LogHelper";
import Network from "./network/Network";
import ProtoMessageHelper from "./network/ProtoMessageHelper";
import { Bag } from "./protobuf/Bag_100";
import { User } from "./protobuf/User_300";

export default class nettest {
    private static net: Network;
    static pb: any;
    public static S() {
        this.net.connect("ws://127.0.0.1", 29110);
    }
    public static D() {

        var req: User.ReqLogin = new User.ReqLogin();
        req.UserName = "test";
        req.Platform = "test";
        req.SdkType = 1;
        req.SdkToken = "test";
        req.Device = "test";
        req.Password = "test";
        this.net.send(req);
        // this.net.send("test", { a: 1, b: 2 });
        // let a = ProtoMessageHelper.getMessageTypeByModule('Bag', 'ReqBagInfo');
        // let s: string = a.getTypeUrl();
        // LogHelper.log(s);
        // let b = ProtoMessageHelper.getIndexByMessageType(s);
        // LogHelper.log(b);
        // let c: protobuf.Bag.ReqSellItem = protobuf.Bag.ReqSellItem.create();
        // c.ItemId = 1;
        // var xxx = protobuf.Bag.ReqSellItem.encode(c).finish();
        // console.log(xxx);
    }
    public static async F() {
        let x = await GameApp.http.get_async("https://download.file.alianblank.com/mine/Android/ChineseSimplified/com.alianblank.mine/1.0.0/20220821225438/StaticVersion.bytes");
        LogHelper.log(x);
    }
    public static A() {
        ProtoMessageHelper.init();
        this.net = new Network();
    }
}