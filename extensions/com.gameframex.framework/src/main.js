'use strict';

const { exec } = require('node:child_process');
const { syncFramework, removeFramework } = require('./sync');

/** 弹窗辅助:编辑器内可用 Editor.Dialog;异常时退化为控制台 */
function notify(title, body) {
  try {
    Editor.Dialog.showMessageBox({ type: 'info', title, message: body, buttons: ['OK'] });
  } catch (error) {
    console.log(`[${title}] ${body}`);
  }
}

exports.methods = {
  'sync-framework'() {
    const projectRoot = Editor.Project.path;
    const result = syncFramework(projectRoot);
    notify(
      'GameFrameX 框架同步完成',
      `版本 ${result.version}\n新增 ${result.added} / 更新 ${result.updated} / 移除 ${result.removed}\n(目标 assets/gameframex,共 ${result.total} 文件)`
    );
  },
  'remove-framework'() {
    const projectRoot = Editor.Project.path;
    const result = removeFramework(projectRoot);
    notify('GameFrameX 框架已移除', `共删除 ${result.removed} 文件(assets/gameframex)`);
  },
  'run-tests'() {
    const projectRoot = Editor.Project.path;
    exec('npm test', { cwd: projectRoot, encoding: 'utf-8' }, (error, stdout, stderr) => {
      const output = `${stdout}\n${stderr}`.slice(-4000);
      const ok = !error;
      try {
        Editor.Dialog.showMessageBox({
          type: ok ? 'info' : 'error',
          title: ok ? 'GameFrameX 单测通过' : 'GameFrameX 单测失败',
          message: output,
          buttons: ['OK'],
        });
      } catch {
        console.log(output);
      }
    });
  },
};

exports.load = function () {
  console.log('[com.gameframex.framework] 扩展已加载');
};

exports.unload = function () {
  console.log('[com.gameframex.framework] 扩展已卸载');
};
