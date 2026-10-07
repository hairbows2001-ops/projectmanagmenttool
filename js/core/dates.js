/*
 * Date helpers. Dates are stored as plain "YYYY-MM-DD" strings and times as "HH:MM",
 * both in Toronto local time. Arithmetic is done in UTC so daylight saving changes
 * never shift a date by one.
 */
(function (WH) {
  'use strict';

  const TZ = 'America/Toronto';
  const DAY_MS = 86400000;
  const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

  function pad(n) { return String(n).padStart(2, '0'); }

  function isISODate(s) {
    if (typeof s !== 'string' || !ISO_RE.test(s)) return false;
    const d = parse(s);
    return toISO(d) === s;
  }

  function isTime(s) { return typeof s === 'string' && TIME_RE.test(s); }

  function parse(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function toISO(date) {
    return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate());
  }

  /** Today's date in Toronto, as YYYY-MM-DD. */
  function todayISO(now) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now || new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    return get('year') + '-' + get('month') + '-' + get('day');
  }

  function addDays(iso, n) {
    return toISO(new Date(parse(iso).getTime() + n * DAY_MS));
  }

  function diffDays(a, b) {
    return Math.round((parse(b).getTime() - parse(a).getTime()) / DAY_MS);
  }

  /** 0 = Monday ... 6 = Sunday */
  function weekdayIndex(iso) {
    return (parse(iso).getUTCDay() + 6) % 7;
  }

  /** Monday of the week containing the date. */
  function weekStart(iso) {
    return addDays(iso, -weekdayIndex(iso));
  }

  function isWeekend(iso) { return weekdayIndex(iso) >= 5; }

  /** Mondays from the week of `startIso` to the week of `endIso`, inclusive. */
  function weeksBetween(startIso, endIso) {
    const out = [];
    let w = weekStart(startIso);
    const last = weekStart(endIso);
    while (w <= last) { out.push(w); w = addDays(w, 7); }
    return out;
  }

  function addMonths(iso, n) {
    const d = parse(iso);
    return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
  }

  function monthStart(iso) { return iso.slice(0, 8) + '01'; }

  /** Weeks (arrays of 7 ISO dates, Monday first) covering a month. */
  function monthGrid(iso) {
    const first = monthStart(iso);
    const nextMonth = addMonths(first, 1);
    const lastDay = addDays(nextMonth, -1);
    return weeksBetween(first, lastDay).map((mon) => {
      const days = [];
      for (let i = 0; i < 7; i++) days.push(addDays(mon, i));
      return days;
    });
  }

  function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  function minutesToTime(min) {
    return pad(Math.floor(min / 60)) + ':' + pad(min % 60);
  }

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  /** "Mon, Oct 12" */
  function fmtShort(iso) {
    if (!iso) return '—';
    const d = parse(iso);
    return DAYS[weekdayIndex(iso)].slice(0, 3) + ', ' + MONTHS[d.getUTCMonth()].slice(0, 3) + ' ' + d.getUTCDate();
  }

  /** "Monday, October 12, 2026" */
  function fmtLong(iso) {
    const d = parse(iso);
    return DAYS[weekdayIndex(iso)] + ', ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
  }

  /** "Oct 12 – 18" */
  function fmtWeek(mon) {
    const sun = addDays(mon, 6);
    const a = parse(mon);
    const b = parse(sun);
    const left = MONTHS[a.getUTCMonth()].slice(0, 3) + ' ' + a.getUTCDate();
    const right = (a.getUTCMonth() === b.getUTCMonth() ? '' : MONTHS[b.getUTCMonth()].slice(0, 3) + ' ') + b.getUTCDate();
    return left + ' – ' + right;
  }

  function fmtMonth(iso) {
    const d = parse(iso);
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  /** "2:30 p.m." */
  function fmtTime(t) {
    if (!t) return '';
    const min = timeToMinutes(t);
    let h = Math.floor(min / 60);
    const m = min % 60;
    const suffix = h >= 12 ? 'p.m.' : 'a.m.';
    h = h % 12 || 12;
    return h + (m ? ':' + pad(m) : '') + ' ' + suffix;
  }

  /** Timestamp for history entries, formatted in Toronto time. */
  function fmtStamp(isoStamp) {
    const d = new Date(isoStamp);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(d);
  }

  WH.dates = {
    TZ, isISODate, isTime, parse, toISO, todayISO, addDays, diffDays, weekdayIndex, weekStart,
    isWeekend, weeksBetween, addMonths, monthStart, monthGrid, timeToMinutes, minutesToTime,
    fmtShort, fmtLong, fmtWeek, fmtMonth, fmtTime, fmtStamp, DAYS, MONTHS
  };
})(globalThis.WH = globalThis.WH || {});
