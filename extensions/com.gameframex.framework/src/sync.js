'use strict';

/**
 * 框架镜像同步(编辑器主进程与 Node CLI 共用;不依赖任何 Editor API)。
 *
 * 规则:
 * - 源:扩展 runtime/gameframex(单一事实源,含随行 *.meta 保证脚本 uuid 跨机器稳定)
 * - 目标:项目 assets/gameframex(生成物,不入库)
 * - 镜像语义:复制新增/变更文件,删除源中已不存在的文件与同名 .meta
 * - 每次同步生成 assets/gameframex/FrameworkVersion.ts(运行时自检可读)
 */

const fs = require('node:fs');
const path = require('node:path');

const EXT_DIR = path.resolve(__dirname, '..');
const RUNTIME_DIR = path.join(EXT_DIR, 'runtime', 'gameframex');
const FOLDER_META_TEMPLATE = path.join(EXT_DIR, 'runtime', 'gameframex.folder.meta');

function listFilesRecursive(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFilesRecursive(full));
    } else if (entry.isFile()) {
      result.push(full);
    }
  }
  return result;
}

function filesIdentical(a, b) {
  const bufA = fs.readFileSync(a);
  const bufB = fs.readFileSync(b);
  return bufA.length === bufB.length && bufA.equals(bufB);
}

function removeEmptyDirs(dir, stopAt) {
  let current = dir;
  while (current.startsWith(stopAt) && current !== stopAt) {
    let remaining;
    try {
      remaining = fs.readdirSync(current);
    } catch {
      return;
    }
    if (remaining.length > 0) {
      return;
    }
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

/**
 * 执行镜像同步。
 * @param {string} projectRoot 项目根目录(编辑器内传 Editor.Project.path;CLI 传 process.cwd())
 * @returns {{added:number,updated:number,removed:number,total:number,version:string}}
 */
function syncFramework(projectRoot) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(EXT_DIR, 'package.json'), 'utf-8'));
  const version = packageJson.version;
  const dstDir = path.join(projectRoot, 'assets', 'gameframex');

  const srcFiles = listFilesRecursive(RUNTIME_DIR);
  const srcRelSet = new Set(srcFiles.map((f) => path.relative(RUNTIME_DIR, f)));

  let added = 0;
  let updated = 0;
  let removed = 0;

  // 1) 删除目标中源已不存在的文件(含同名 .meta)
  if (fs.existsSync(dstDir)) {
    for (const dstFile of listFilesRecursive(dstDir)) {
      const rel = path.relative(dstDir, dstFile);
      if (!srcRelSet.has(rel)) {
        fs.unlinkSync(dstFile);
        removed++;
      }
    }
    removeEmptyDirs(dstDir, dstDir);
  }

  // 2) 复制新增/变更文件(内容一致则跳过,避免触发编辑器重导入)
  for (const srcFile of srcFiles) {
    const rel = path.relative(RUNTIME_DIR, srcFile);
    const dstFile = path.join(dstDir, rel);
    if (fs.existsSync(dstFile)) {
      if (!filesIdentical(srcFile, dstFile)) {
        fs.copyFileSync(srcFile, dstFile);
        updated++;
      }
    } else {
      fs.mkdirSync(path.dirname(dstFile), { recursive: true });
      fs.copyFileSync(srcFile, dstFile);
      added++;
    }
  }

  // 3) 目录级 meta(assets/gameframex.meta,uuid 稳定)
  if (fs.existsSync(FOLDER_META_TEMPLATE)) {
    fs.copyFileSync(FOLDER_META_TEMPLATE, path.join(projectRoot, 'assets', 'gameframex.meta'));
  }

  // 4) 版本戳(运行时自检/诊断可读;内容变化才写)
  const versionFile = path.join(dstDir, 'FrameworkVersion.ts');
  const versionContent = `// 由 com.gameframex.framework 扩展生成,请勿手改\nexport const FRAMEWORK_VERSION = "${version}";\n`;
  if (!fs.existsSync(versionFile) || fs.readFileSync(versionFile, 'utf-8') !== versionContent) {
    fs.writeFileSync(versionFile, versionContent);
  }

  return { added, updated, removed, total: srcFiles.length, version };
}

/**
 * 移除项目内框架(保留 assets/gameframex.meta 由编辑器自行清理)。
 * @param {string} projectRoot 项目根目录
 * @returns {{removed:number}}
 */
function removeFramework(projectRoot) {
  const dstDir = path.join(projectRoot, 'assets', 'gameframex');
  if (!fs.existsSync(dstDir)) {
    return { removed: 0 };
  }
  const count = listFilesRecursive(dstDir).length;
  fs.rmSync(dstDir, { recursive: true, force: true });
  const folderMeta = path.join(projectRoot, 'assets', 'gameframex.meta');
  if (fs.existsSync(folderMeta)) {
    fs.unlinkSync(folderMeta);
  }
  return { removed: count };
}

module.exports = { syncFramework, removeFramework, RUNTIME_DIR };
