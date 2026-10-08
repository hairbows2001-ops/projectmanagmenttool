/*
 * People. Names and titles only (no photographs).
 *  - Demo: the fixed fictional profiles below.
 *  - Team workspace: the server sends the list of accounts, and setPeople() replaces these.
 */
(function (WH) {
  'use strict';

  // role: 'owner' = Maha (communications workspace owner)
  //       'executive' = Carla (sets priorities, approves work)
  //       'manager' = submits requests and meeting proposals
  const DEMO_PEOPLE = [
    { id: 'carla', name: 'Carla Neto', first: 'Carla', title: 'Executive Director', role: 'executive', main: true },
    { id: 'lina', name: 'Lina Almanzan', first: 'Lina', title: 'Director of Philanthropy', role: 'manager', main: true },
    { id: 'christine', name: 'Christine Boeck', first: 'Christine', title: 'Manager of Community Programs and Services', role: 'manager', main: true },
    { id: 'leslie', name: 'Leslie Burrow', first: 'Leslie', title: 'Manager of Human Resources', role: 'manager', main: false },
    { id: 'sheila', name: 'Sheila Barro', first: 'Sheila', title: 'Finance Manager', role: 'manager', main: false },
    { id: 'alicia', name: 'Alicia Whyte', first: 'Alicia', title: 'Manager of Residential Services', role: 'manager', main: false },
    { id: 'esperanca', name: 'Esperança Panzo', first: 'Esperança', title: 'Facilities Manager', role: 'manager', main: false },
    { id: 'maha', name: 'Maha', first: 'Maha', title: 'Communications workspace owner', role: 'owner', main: true }
  ];

  const api = { PEOPLE: DEMO_PEOPLE.slice(), DEMO_PEOPLE };
  let byId = {};
  function index() { byId = Object.fromEntries(api.PEOPLE.map((p) => [p.id, p])); }
  index();

  /** Replaces the list (team workspace accounts). Inactive accounts keep their names in history. */
  function setPeople(list) {
    api.PEOPLE = (list || []).map((p) => Object.assign({ first: String(p.name || '').split(' ')[0], main: true }, p));
    index();
  }

  // People from an imported export who have no account here are stored as "former:Name".
  const former = (id) => (typeof id === 'string' && id.startsWith('former:') ? id.slice(7) : null);

  function get(id) { const p = byId[id]; return p && !p.inactive ? p : null; }
  function name(id) {
    if (byId[id]) return byId[id].name;
    if (former(id)) return former(id);
    return id === 'system' ? 'Workflow update' : 'Unknown';
  }
  function first(id) { return byId[id] ? byId[id].first : former(id) ? former(id).split(' ')[0] : 'Unknown'; }
  /** People who can submit requests (everyone except Maha). */
  function requesters() { return api.PEOPLE.filter((p) => p.role !== 'owner' && !p.inactive); }

  Object.assign(api, { get, name, first, requesters, setPeople });
  WH.people = api;
})(globalThis.WH = globalThis.WH || {});
