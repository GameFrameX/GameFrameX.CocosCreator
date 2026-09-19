import { describe, expect, it } from "vitest";
import PatchPlanner, { PatchManifest, VersionStore } from "../../assets/gameframex/download/PatchPlanner";

/**
 * PatchPlanner 契约(spec §3.4 Patch 六步核心,引擎无关):
 * - VersionStore:本地 bundle 版本记录(get/set,持久化由注入 KV 决定)
 * - PatchPlanner.plan(manifest, store):版本未记录或哈希不同 → 需更新;
 *   版本一致 → 空计划(无差异)
 */
describe("PatchPlanner(远程 Bundle 版本检查/差异计划)", () => {
    const manifest: PatchManifest = {
        version: 3,
        bundles: { remote: "abc123", base: "def456" },
    };

    it("未记录版本的 bundle 计划为需更新(首次启动全量)", () => {
        const store = new VersionStore(new Map<string, string>() as never);
        const plan = PatchPlanner.plan(manifest, store, ["remote"]);
        expect(plan.bundlesToUpdate).toEqual(["remote"]);
    });

    it("哈希一致的计划为空(无差异,秒过)", () => {
        const kv = new Map<string, string>([["patch.version.remote", "abc123"]]);
        const store = new VersionStore(kv as never);
        const plan = PatchPlanner.plan(manifest, store, ["remote"]);
        expect(plan.bundlesToUpdate).toEqual([]);
        expect(plan.upToDate).toBe(true);
    });

    it("远端哈希变化 → 需更新;plan 应用后记录新版本", () => {
        const kv = new Map<string, string>([["patch.version.remote", "old"]]);
        const store = new VersionStore(kv as never);
        const plan = PatchPlanner.plan(manifest, store, ["remote"]);
        expect(plan.upToDate).toBe(false);
        PatchPlanner.apply(plan, manifest, store);
        expect(store.get("remote")).toBe("abc123");
    });
});
