(function (global) {
  'use strict';
  global.CandyBoot = Object.freeze({ start: function (config) {
    const status = document.getElementById('status');
    const mode = document.getElementById('play-mode');
    let failed = false;
    global.candyLogs = [];
    global.candyBootState = 'waiting-for-save';
    function log(message) {
      global.candyLogs.push(String(message));
      console.log(message);
    }
    function error(message) {
      failed = true;
      global.candyBootState = 'error';
      log(message);
      status.hidden = false;
      status.textContent = '暂时无法进入本关\n' + String(message);
    }
    global.addEventListener('error', function (event) { error(event.message); });
    global.addEventListener('unhandledrejection', function (event) { error(event.reason); });
    global.addEventListener('candy-local-mode', function (event) {
      mode.hidden = false;
      mode.textContent = event.detail.message;
    });
    // Download caching must also be disabled in PlayerSettings. The generated
    // cached loader touches storage before honoring cacheControl in a sandbox.
    config.cacheControl = function () { return 'no-store'; };
    config.print = function (message) {
      if (/\[libil2cpp\].*ERROR|Could not open.*global-metadata/i.test(message)) error(message);
      else log(message);
    };
    config.printErr = function (message) {
      if (/error|exception|abort/i.test(message)) error(message);
      else log(message);
    };
    config.showBanner = function (message, type) { if (type === 'error') error(message); else log(message); };
    return global.CandyRelay.ready().then(function () {
      global.candyBootState = 'loading';
      return createUnityInstance(document.getElementById('unity-canvas'), config, function (progress) {
        if (!failed) status.textContent = progress < 1 ? '正在加载糖果工厂……' + Math.round(progress * 100) + '%' : '正在进入糖果工厂……';
      });
    }).then(function (instance) {
      global.candyUnity = instance;
      if (!failed) { status.hidden = true; global.candyBootState = 'ready'; }
      return instance;
    }).catch(error);
  } });
})(window);
