// The save stays in this closure. Unity only signals completion; it never rebuilds the save.
(function (global) {
  'use strict';
  let snapshot = null;
  let readyPromise = null;
  let completion = null;

  function ready() {
    if (!readyPromise) {
      readyPromise = Promise.resolve().then(function () {
        if (!global.WL || typeof global.WL.ready !== 'function' || typeof global.WL.complete !== 'function') {
          throw new Error('接力接口未加载，请从大厅或本地模拟器打开本关。');
        }
        return global.WL.ready();
      }).then(function (save) {
        if (!save || typeof save !== 'object' || !save.player) {
          throw new Error('未收到有效的入场存档。');
        }
        // Capture every JSON field, including item effects, settled and player.deaths.
        snapshot = JSON.stringify(save);
      });
    }
    return readyPromise;
  }

  function complete() {
    if (!snapshot) return Promise.reject(new Error('尚未收到入场存档，不能交接。'));
    // Retain both success and rejection: a timeout has an unknown outcome, so never replay it.
    if (!completion) {
      completion = Promise.resolve().then(function () {
        return global.WL.complete(JSON.parse(snapshot), { acquiredItemIds: [] });
      }).then(function (receipt) {
        if (!receipt || receipt.ok === false ||
            !(receipt.persisted === true || (receipt.preview === true && receipt.persisted === false))) {
          throw new Error('未收到有效的交接回执，请返回大厅核对进度。');
        }
        return { persisted: receipt.persisted === true, preview: receipt.preview === true };
      });
    }
    return completion;
  }

  // Follow authoritative SDK heal/respawn updates if the host keeps the iframe alive.
  global.addEventListener('iw-admin', function (event) {
    const save = event.detail && event.detail.save;
    if (snapshot && !completion && save && save.player) snapshot = JSON.stringify(save);
  });

  global.CandyRelay = Object.freeze({ ready: ready, complete: complete });
})(window);
