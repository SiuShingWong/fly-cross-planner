var path = require('path');
var base = path.join(__dirname, '..');
require(path.join(base, 'data', 'library.js'));
require(path.join(base, 'data', 'stock-source.js'));
require(path.join(base, 'data', 'stocks.js'));
require(path.join(base, 'engine', 'genetics.js'));
require(path.join(base, 'engine', 'phenotype.js'));
require(path.join(base, 'engine', 'parse.js'));
require(path.join(base, 'ui', 'flyart.js'));
require(path.join(base, 'ui', 'alleleprops.js'));
require(path.join(base, 'data', 'tools.js'));
require(path.join(base, 'engine', 'planner.js'));
require(path.join(base, 'engine', 'scheme.js'));
require(path.join(base, 'engine', 'bench.js'));
require(path.join(__dirname, 'tests.js'));
var results = globalThis.FCS.tests.run();
var failed = 0;
results.forEach(function (r) {
  if (r.pass) console.log('  pass  ' + r.name);
  else { failed++; console.log('  FAIL  ' + r.name + '\n          ' + r.message); }
});
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
process.exit(failed ? 1 : 0);
