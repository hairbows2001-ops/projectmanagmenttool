/* Profiles. Names and titles only (no photographs). */
(function (WH) {
  'use strict';

  // role: 'owner' = Maha (communications workspace owner)
  //       'executive' = Carla (sets priorities, approves work)
  //       'manager' = submits requests and meeting proposals
  const PEOPLE = [
    { id: 'carla', name: 'Carla Neto', first: 'Carla', title: 'Executive Director', role: 'executive', main: true },
    { id: 'lina', name: 'Lina Almanzan', first: 'Lina', title: 'Director of Philanthropy', role: 'manager', main: true },
    { id: 'christine', name: 'Christine Boeck', first: 'Christine', title: 'Manager of Community Programs and Services', role: 'manager', main: true },
    { id: 'leslie', name: 'Leslie Burrow', first: 'Leslie', title: 'Manager of Human Resources', role: 'manager', main: false },
    { id: 'sheila', name: 'Sheila Barro', first: 'Sheila', title: 'Finance Manager', role: 'manager', main: false },
    { id: 'alicia', name: 'Alicia Whyte', first: 'Alicia', title: 'Manager of Residential Services', role: 'manager', main: false },
    { id: 'esperanca', name: 'Esperança Panzo', first: 'Esperança', title: 'Facilities Manager', role: 'manager', main: false },
    { id: 'maha', name: 'Maha', first: 'Maha', title: 'Communications workspace owner', role: 'owner', main: true }
  ];

  const byId = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

  function get(id) { return byId[id] || null; }
  function name(id) { return byId[id] ? byId[id].name : 'Unknown'; }
  function first(id) { return byId[id] ? byId[id].first : 'Unknown'; }
  /** People who can submit requests (everyone except Maha). */
  function requesters() { return PEOPLE.filter((p) => p.role !== 'owner'); }

  WH.people = { PEOPLE, get, name, first, requesters };
})(globalThis.WH = globalThis.WH || {});
