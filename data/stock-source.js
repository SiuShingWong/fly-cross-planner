/* Fly Cross Planner - where the stock list comes from.
 *
 * The Raff Lab sheet is only the list this copy happens to ship with. Any lab
 * can load its own: a CSV, a TSV or a JSON export, read in the browser with no
 * server and no upload. Everything that reads stocks - the browser in the
 * sidebar, the spelling finder, the planner - goes through FCS.stockList()
 * rather than FCS.stocks, so swapping the list swaps it everywhere at once.
 *
 * Exports FCS.stockSource — load, use, useBuiltIn, describe, parseFile, fileText,
 *   download, onChange, active; and FCS.stockList(), which everything else
 *   calls rather than touching FCS.stocks directly
 * Needs FCS.stocks and FCS.myStocks.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};
  var KEY = 'flyCrossSim.stockList.v1';
  var custom = null;               /* {name, rows} once a list of your own is in use */
  var listeners = [];

  function builtIn() { return FCS.stocks || []; }
  function active() { return custom ? custom.rows : builtIn(); }

  function describe() {
    var rows = active(), held = 0, i;
    for (i = 0; i < rows.length; i++) if (rows[i].s) held++;
    return {
      own: !!custom,
      name: custom ? custom.name : 'the standard stocks this copy ships with',
      total: rows.length,
      held: held
    };
  }

  /* ---------- reading a file ---------- */

  /* A comma or tab separated file, quotes and embedded newlines handled. Never
     semicolon-separated: a genotype is full of semicolons. */
  function splitRows(text, sep) {
    var rows = [], row = [], cell = '', quoted = false, i, c;
    text = String(text).replace(/\r\n?/g, '\n');
    for (i = 0; i < text.length; i++) {
      c = text.charAt(i);
      if (quoted) {
        if (c === '"' && text.charAt(i + 1) === '"') { cell += '"'; i++; }
        else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.join('').trim() !== ''; });
  }

  function guessSep(text) {
    var line = String(text).split(/\r?\n/)[0] || '';
    var tabs = (line.match(/\t/g) || []).length;
    var commas = (line.match(/,/g) || []).length;
    return tabs > commas ? '\t' : ',';
  }

  var ROLES = [
    ['g', /genotype|^geno\b/i],
    ['s', /in\s*stock|^stock\?|held|alive|available|^live$|^status$|^kept$/i],
    ['d', /desc|note|comment|remark/i],
    ['p', /project|category|^gene$|group/i],
    ['n', /stock\s*(no|num|#|id)|^no\.?$|^n$|^#$|^id$|^line$|^vial$|^stock$|number|code/i]
  ];

  function mapColumns(head) {
    var used = {}, map = {};
    ROLES.forEach(function (role) {
      for (var i = 0; i < head.length; i++) {
        if (used[i]) continue;
        if (role[1].test(String(head[i]).trim())) { map[role[0]] = i; used[i] = true; return; }
      }
    });
    return map;
  }

  function looksLikeHeader(row) {
    for (var i = 0; i < row.length; i++) {
      if (/genotype|^geno\b|stock|project|desc|in\s*stock/i.test(String(row[i]).trim())) return true;
    }
    return false;
  }

  /* No usable header: the genotype column is the one with the most slashes and
     semicolons in it, which is what a genotype looks like and nothing else does. */
  function guessGenotypeColumn(rows) {
    var scores = [], r, c, cell;
    for (r = 0; r < rows.length; r++) {
      for (c = 0; c < rows[r].length; c++) {
        cell = String(rows[r][c] || '');
        scores[c] = (scores[c] || 0) + (cell.match(/[\/;]/g) || []).length;
      }
    }
    var best = 0;
    for (c = 0; c < scores.length; c++) if ((scores[c] || 0) > (scores[best] || 0)) best = c;
    return (scores[best] || 0) > 0 ? best : -1;
  }

  var YES = /^(y|yes|true|1|x|in\s*stock|held|live|alive|kept|ok|✓)$/i;

  function heldValue(v) {
    if (v === undefined || v === null) return 1;
    var s = String(v).trim();
    if (!s) return 0;
    return YES.test(s) ? 1 : 0;
  }

  function fromJson(text) {
    var data = JSON.parse(text);
    var arr = Array.isArray(data) ? data : (data && Array.isArray(data.rows) ? data.rows : null);
    if (!arr) throw new Error('that JSON file is not a list of stocks');
    var rows = [], skipped = 0;
    arr.forEach(function (o, i) {
      var low = {}, k;
      for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) low[String(k).toLowerCase()] = o[k];
      var g = low.g || low.genotype || low.geno || '';
      if (!String(g).trim()) { skipped++; return; }
      rows.push({
        n: String(low.n || low.stock || low['stock number'] || low.id || low.number || ('row ' + (i + 1))),
        g: String(g),
        d: String(low.d || low.description || low.note || low.notes || ''),
        p: String(low.p || low.project || ''),
        s: low.s !== undefined ? heldValue(low.s)
          : (low['in stock'] !== undefined ? heldValue(low['in stock']) : 1)
      });
    });
    return { rows: rows, skipped: skipped, columns: 'the fields in the file' };
  }

  /* Returns {rows, skipped, columns} or throws with something readable. */
  function parseFile(text, filename) {
    if (/\.json$/i.test(filename || '') || /^\s*[\[{]/.test(text)) return fromJson(text);
    var grid = splitRows(text, guessSep(text));
    if (!grid.length) throw new Error('that file has no rows in it');

    var head = null, body = grid, map = {};
    if (looksLikeHeader(grid[0])) { head = grid[0]; body = grid.slice(1); map = mapColumns(head); }
    if (map.g === undefined) {
      var guess = guessGenotypeColumn(body);
      if (guess < 0) {
        throw new Error('no genotype column found. Name one of the columns "Genotype", '
          + 'or save the sheet with the genotypes in their own column.');
      }
      map.g = guess;
      if (map.n === undefined && guess !== 0) map.n = 0;
    }

    var rows = [], skipped = 0;
    body.forEach(function (r, i) {
      var g = String(r[map.g] || '').trim();
      if (!g) { skipped++; return; }
      rows.push({
        n: String(map.n !== undefined ? (r[map.n] || '') : '').trim() || ('row ' + (i + 1)),
        g: g,
        d: String(map.d !== undefined ? (r[map.d] || '') : '').trim(),
        p: String(map.p !== undefined ? (r[map.p] || '') : '').trim(),
        s: map.s !== undefined ? heldValue(r[map.s]) : 1
      });
    });
    if (!rows.length) throw new Error('no rows in that file had a genotype in them');

    var named = [];
    ['n', 'g', 'd', 'p', 's'].forEach(function (k) {
      if (map[k] === undefined) return;
      var label = head ? String(head[map[k]]).trim() : 'column ' + (map[k] + 1);
      named.push(({ n: 'number', g: 'genotype', d: 'description', p: 'project', s: 'in stock' })[k]
        + ' from "' + label + '"');
    });
    return { rows: rows, skipped: skipped, columns: named.join(', ') };
  }

  /* ---------- swapping the list ---------- */

  function changed() { listeners.forEach(function (fn) { fn(describe()); }); }

  function use(rows, name) {
    custom = { name: name || 'your list', rows: rows };
    remember();
    changed();
    return describe();
  }

  function useBuiltIn() {
    custom = null;
    try { root.localStorage && root.localStorage.removeItem(KEY); } catch (e) { /* storage off */ }
    changed();
    return describe();
  }

  function remember() {
    try {
      var blob = JSON.stringify(custom);
      if (blob.length < 3000000) root.localStorage.setItem(KEY, blob);
    } catch (e) { /* private window, or the list is too big. The file export still works. */ }
  }

  /* my-stocks.js sits beside the app and loads at startup, so a list survives a
     cleared browser and can be handed to someone else with the folder. */
  function fileText() {
    var payload = custom || { name: 'my stocks', rows: builtIn() };
    return '/* A stock list for the Fly Cross Planner.\n'
      + ' * Written by the app from ' + String(payload.name).replace(/\*\//g, '') + '.\n'
      + ' * Drop this into data/my-stocks.js and it loads when the app opens.\n'
      + ' */\n'
      + '(function (root) {\n'
      + "  'use strict';\n"
      + '  var FCS = root.FCS = root.FCS || {};\n'
      + '  FCS.myStocks = ' + JSON.stringify({ name: payload.name, rows: payload.rows }) + ';\n'
      + "})(typeof globalThis !== 'undefined' ? globalThis : this);\n";
  }

  function download() {
    var blob = new root.Blob([fileText()], { type: 'text/javascript' });
    var url = root.URL.createObjectURL(blob);
    var a = root.document.createElement('a');
    a.href = url;
    a.download = 'my-stocks.js';
    root.document.body.appendChild(a);
    a.click();
    root.document.body.removeChild(a);
    root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 1000);
  }

  /* The file on disk is the baseline; a list loaded in this browser sits on top. */
  function load() {
    if (FCS.myStocks && FCS.myStocks.rows && FCS.myStocks.rows.length) {
      custom = { name: FCS.myStocks.name || 'data/my-stocks.js', rows: FCS.myStocks.rows };
    }
    try {
      var raw = root.localStorage && root.localStorage.getItem(KEY);
      var stored = raw ? JSON.parse(raw) : null;
      if (stored && stored.rows && stored.rows.length) custom = stored;
    } catch (e) { /* storage off */ }
  }

  FCS.stockSource = {
    load: load, use: use, useBuiltIn: useBuiltIn, describe: describe,
    parseFile: parseFile, fileText: fileText, download: download,
    onChange: function (fn) { listeners.push(fn); },
    active: active
  };
  FCS.stockList = active;
})(typeof globalThis !== 'undefined' ? globalThis : this);
