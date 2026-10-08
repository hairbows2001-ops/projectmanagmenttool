// Loads the browser rule files into Node for testing (no packages needed).
const path = require('path');
const files = ['util', 'dates', 'people', 'config', 'permissions', 'capacity', 'approval', 'workflow', 'seed'];
files.forEach((f) => require(path.join(__dirname, '..', 'js', 'core', f + '.js')));
module.exports = globalThis.WH;
