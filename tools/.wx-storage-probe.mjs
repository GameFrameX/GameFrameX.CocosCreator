import automator from "miniprogram-automator";
const mp = await automator.connect({ wsEndpoint: "ws://localhost:9420" });
const result = await mp.evaluate(() => {
    const g = globalThis;
    const wxApi = g.wx;
    return wxApi ? wxApi.getStorageSync("gfx_startup") : { error: "no wx" };
});
console.log("=== gfx_startup(storage) ===");
console.log(JSON.stringify(result));
await mp.disconnect();
process.exit(0);
