// Every browser script must at least parse. Catches typos in screen code that the rule tests don't load.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'js');
const files = [];
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  });
})(root);

test('all browser scripts are valid JavaScript', () => {
  assert.ok(files.length > 10);
  files.forEach((f) => {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }), path.relative(root, f));
  });
});
