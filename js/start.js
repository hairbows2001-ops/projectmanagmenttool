/*
 * Starts the app once every screen has loaded.
 * Very old browsers (for example Internet Explorer, or Safari before version 15) get a clear message
 * instead of a broken page. Current Edge, Chrome, Safari and Firefox pass this check.
 */
(function () {
  'use strict';
  var ok = typeof fetch === 'function' && typeof Promise === 'function' && window.CSS && typeof CSS.escape === 'function' &&
    typeof Element.prototype.closest === 'function' && typeof Intl === 'object' && typeof Intl.DateTimeFormat.prototype.formatToParts === 'function' &&
    typeof Blob.prototype.text === 'function' && 'inert' in HTMLElement.prototype;
  if (!ok) {
    document.getElementById('app').innerHTML = '<main id="main" style="max-width:560px;margin:60px auto;padding:0 20px;font-family:sans-serif">' +
      '<h1>Please update your browser</h1><p>This workspace needs a current version of Microsoft Edge, Google Chrome or Safari. ' +
      'Your browser is too old to run it safely.</p><p>On Windows, open it in Microsoft Edge. On a Mac, update macOS (which updates Safari) or use Chrome.</p></main>';
    return;
  }
  WH.start();
})();
