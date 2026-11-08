// The save stays in this closure. Unity only signals completion; it never rebuilds the save.
(function (global) {
  'use strict';
  let snapshot = null;
  let readyPromise = null;
  let completion = null;
  let mode = 'pending';

  function localSave() {
    return {
      schema: 'v3', level: 1,
      player: { hp: 3, max_hp: 3, sanity: 2, level: 1, status: 'normal', curses: [] },
      items: [], clues: [], exit_hook: '', prev_world: '', next_world: '', tombstone: {}
    };
  }

  function useLocalSave(error) {
    mode = 'local';
    snapshot = JSON.stringify(localSave());
    global.dispatchEvent(new CustomEvent('candy-local-mode', {
      detail: { message: error ? '大厅连接未完成，当前为本地试玩，进度不会上传。' : '本地试玩模式，进度不会上传。' }
    }));
    if (error) console.warn('[CandyRelay] Host handshake failed; local practice only.', error);
  }

  function ready() {
    if (!readyPromise) {
      readyPromise = Promise.resolve().then(function () {
        if (global.parent === global) {
          useLocalSave();
          return;
        }
        if (!global.WL || typeof global.WL.ready !== 'function' || typeof global.WL.complete !== 'function') {
          throw new Error('接力接口未加载，请从大厅或本地模拟器打开本关。');
        }
        return global.WL.ready();
      }).then(function (save) {
        if (mode === 'local') return;
        if (!save || typeof save !== 'object' || !save.player) {
          throw new Error('未收到有效的入场存档。');
        }
        // Capture every JSON field, including item effects, settled and player.deaths.
        snapshot = JSON.stringify(save);
        mode = 'host';
      }).catch(function (error) {
        useLocalSave(error);
      });
    }
    return readyPromise;
  }

  function finish(failed, reason) {
    if (!snapshot) return Promise.reject(new Error('尚未收到入场存档，不能交接。'));
    // Retain both success and rejection: a timeout has an unknown outcome, so never replay it.
    if (!completion) {
      completion = Promise.resolve().then(function () {
        if (mode === 'local') return { ok: true, local: true, persisted: false, preview: true };
        if (failed) return global.WL.fail(reason, JSON.parse(snapshot), { acquiredItemIds: [] });
        return global.WL.complete(JSON.parse(snapshot), { acquiredItemIds: [] });
      }).then(function (receipt) {
        if (!receipt || receipt.ok === false ||
            !(receipt.persisted === true || (receipt.preview === true && receipt.persisted === false))) {
          throw new Error('未收到有效的交接回执，请返回大厅核对进度。');
        }
        return { persisted: receipt.persisted === true, preview: receipt.preview === true, local: receipt.local === true };
      });
    }
    return completion;
  }

  function complete() { return finish(false); }
  function fail(reason) { return finish(true, reason || '本关探索失败'); }

  // Follow authoritative SDK heal/respawn updates if the host keeps the iframe alive.
  global.addEventListener('iw-admin', function (event) {
    const save = event.detail && event.detail.save;
    if (mode === 'host' && snapshot && !completion && save && save.player) snapshot = JSON.stringify(save);
  });

  global.CandyRelay = Object.freeze({
    ready: ready, complete: complete, fail: fail,
    readSave: function () { return snapshot ? JSON.parse(snapshot) : null; },
    get mode() { return mode; }
  });
})(window);
