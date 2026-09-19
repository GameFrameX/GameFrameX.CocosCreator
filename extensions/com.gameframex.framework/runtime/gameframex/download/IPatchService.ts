import type { PatchManifest } from "./PatchPlanner";

/**
 * Patch 服务契约(引擎无关;UpdateStaticVersion/DownloadWebFiles 阶段的外部能力注入)。
 *
 * 引擎实现(startup 层):manifest 拉取经 fetch/wx.request;远程 Bundle 经
 * assetManager.loadBundle(name, { server })(差异细节由 Cocos md5 机制承担)。
 * 测试注入 mock;失败以 reject 上抛(状态机捕获并终止启动链)。
 */
export interface IPatchService {
    /**
     * 拉取远程版本清单(JSON)。
     */
    fetchManifest(url: string): Promise<PatchManifest>;

    /**
     * 加载/重载远程 Bundle(server 为 CDN 基址;主备由实现内部处理)。
     * @param onProgress 进度回调 0..1(bundle 内部文件粒度)
     */
    loadRemoteBundle(name: string, server: string, onProgress?: (progress: number) => void): Promise<void>;
}
