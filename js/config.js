/*
 * Which version of the app this is.
 *  - 'demo': fictional sample data, simulated profiles, saved in this browser only (this file).
 *  - 'team': the team server replaces this file with mode 'team' (real accounts, shared database).
 */
(function (WH) {
  'use strict';
  WH.config = WH.config || { mode: 'demo' };
})(globalThis.WH = globalThis.WH || {});
