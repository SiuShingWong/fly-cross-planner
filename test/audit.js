/* Fly Cross Planner - does the app still hang together?
 *
 * There is no build step and no module loader, so the only thing keeping the
 * files in a working order is the list of script tags in index.html. This reads
 * that list, works out what each file puts on FCS and what it reaches for, and
 * complains about the two mistakes that produce a blank page:
 *
 *   - a file uses a namespace nothing loaded defines;
 *   - a file uses one at load time that is defined later in the order.
 *
 * A namespace that is deliberately absent (the parked planner) is allowed as
 * long as every use of it is guarded. Run it after the tests:
 *
 *     node test/run.js && node test/audit.js
 */
var fs = require('fs');
var path = require('path');

var base = path.join(__dirname, '..');
var page = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
var order = (page.match(/<script src="([^"]+)"><\/script>/g) || []).map(function (t) {
  return t.replace(/.*src="([^"]+)".*/, '$1');
});

var PARKED = ['planner', 'planPane', 'targetBuilder'];

/* Comments are stripped first: a file that only MENTIONS a namespace in its
   header ("Needs FCS.mapEditor") is not using it. */
function read(f) {
  return fs.readFileSync(path.join(base, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}

/* Function bodies are stripped, crudely, to leave roughly what runs on load. */
function topLevel(src) {
  var out = src, before;
  do {
    before = out;
    out = out.replace(/function[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
  } while (out !== before);
  return out;
}

var defines = {}, uses = {}, guarded = {};
order.forEach(function (f) {
  var src = read(f);
  defines[f] = (src.match(/FCS\.([A-Za-z_]\w*)\s*=/g) || []).map(function (m) {
    return m.replace(/FCS\.([A-Za-z_]\w*)\s*=/, '$1');
  });
  uses[f] = (src.match(/FCS\.([A-Za-z_]\w*)/g) || []).map(function (m) { return m.slice(4); });
  guarded[f] = {};
  PARKED.forEach(function (name) {
    if (new RegExp('FCS\\.' + name + '\\s*&&').test(src)) guarded[f][name] = true;
  });
});

var definedBy = {};
order.forEach(function (f) {
  defines[f].forEach(function (n) { if (!definedBy[n]) definedBy[n] = f; });
});

var problems = [];
order.forEach(function (f, i) {
  uses[f].forEach(function (n) {
    if (defines[f].indexOf(n) >= 0) return;
    if (!definedBy[n]) {
      if (PARKED.indexOf(n) >= 0 && guarded[f][n]) return;      /* parked, and guarded */
      problems.push(f + ' uses FCS.' + n + ', which nothing in index.html defines');
      return;
    }
    if (order.indexOf(definedBy[n]) > i) {
      /* only a problem if it is reached for while the file is loading */
      var top = topLevel(read(f));
      if (new RegExp('FCS\\.' + n + '\\b').test(top)) {
        problems.push(f + ' uses FCS.' + n + ' at load time, but ' + definedBy[n] + ' comes later');
      }
    }
  });
});

var seen = {};
problems = problems.filter(function (p) { return seen[p] ? false : (seen[p] = true); });

if (problems.length) {
  problems.forEach(function (p) { console.log('  PROBLEM  ' + p); });
  console.log('\n' + problems.length + ' problem' + (problems.length === 1 ? '' : 's') + ' in the load order');
  process.exit(1);
}
console.log(order.length + ' files, ' + Object.keys(definedBy).length
  + ' namespaces, load order hangs together');
