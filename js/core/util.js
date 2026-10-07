/* Small shared helpers. Loaded first. Works in the browser and in Node tests. */
(function (WH) {
  'use strict';

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let counter = 0;
  function uid(prefix) {
    counter += 1;
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + counter.toString(36) +
      Math.floor(Math.random() * 1e6).toString(36);
  }

  // One decimal place, avoiding floating point noise such as 31.700000000000003.
  function round1(n) {
    return Math.round((Number(n) + Number.EPSILON) * 10) / 10;
  }

  function fmtHours(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    const r = round1(n);
    return (Number.isInteger(r) ? String(r) : r.toFixed(1)) + ' h';
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /** Thrown when an action is not allowed for the current profile. */
  class PermissionError extends Error {
    constructor(message) {
      super(message);
      this.name = 'PermissionError';
    }
  }

  /** Thrown when input is invalid. `fields` maps field names to messages. */
  class ValidationError extends Error {
    constructor(fields, message) {
      super(message || Object.values(fields)[0] || 'Please check the form.');
      this.name = 'ValidationError';
      this.fields = fields;
    }
  }

  WH.util = { esc, uid, round1, fmtHours, clone, PermissionError, ValidationError };
})(globalThis.WH = globalThis.WH || {});
