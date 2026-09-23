/* Fly Cross Planner - the bench.  *
 * Exports FCS.app — init, state, view(). The bench: every piece of state, every
 *   render, every event handler.
 * Needs all of the above. It is last in the load order, and the only file that
 *   touches the DOM outside its own panel.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};
  var G, P, esc;

  var state = {
    vials: [],
    activeId: null,
    mother: null,
    father: null,
    lastPickedKey: null,
    inspected: null,
    startDate: null,
    genDays: 14,
    temperature: 25,
    schemeAll: true,
    nextId: 1,
    sampleSize: 100
  };

  var view = null, el = {};

  /* ---------- vials ---------- */

  function makeItem(fly) {
    return { id: 'f' + (state.nextId++), fly: fly, phenotype: P.of(fly), selected: false };
  }

  function addVial(name, flies, meta) {
    var v = {
      id: 'v' + (state.nextId++),
      name: name,
      items: flies.map(makeItem),
      meta: meta || null
    };
    state.vials.push(v);
    state.activeId = v.id;
    return v;
  }

  /* A saved cross keeps its parents, not its result. Work it out when something
     actually asks, and keep it from then on. */
  function resultOf(v) {
    if (!v || !v.meta || v.meta.kind !== 'cross') return null;
    if (v.meta.result) return v.meta.result;
    if (!v.meta.motherFly || !v.meta.fatherFly) return null;
    try {
      v.meta.result = G.cross(v.meta.motherFly, v.meta.fatherFly);
    } catch (e) {
      v.meta.result = null;
    }
    return v.meta.result;
  }

  function activeVial() {
    for (var i = 0; i < state.vials.length; i++) if (state.vials[i].id === state.activeId) return state.vials[i];
    return null;
  }

  /* A stock whose number IS its genotype - which is how the shipped list reads,
     and how plenty of lab sheets read - should not have it written twice. */
  function vialName(st) {
    var n = String(st.n || '').trim();
    var g = String(st.g || '').trim();
    if (!n) return g;
    if (!g) return n;
    var tidy = function (t) { return t.toLowerCase().replace(/[\s,;]+/g, ''); };
    return tidy(n).indexOf(tidy(g)) >= 0 || tidy(g).indexOf(tidy(n)) >= 0 ? n : n + '  ' + g;
  }

  function stockVial(name, genotype, counts, extra) {
    var flies = [], i, meta = { kind: 'stock', genotype: genotype };
    ['F', 'M'].forEach(function (sex) {
      var parsed = FCS.parse.parse(genotype, sex);
      if (!parsed.ok) throw new Error('cannot read "' + genotype + '": ' + parsed.unknown.join(', '));
      meta.newMarkers = parsed.newMarkers;
      meta.compounds = parsed.compounds;
      for (i = 0; i < (counts[sex] || 0); i++) flies.push(parsed.fly);
    });
    if (extra) Object.keys(extra).forEach(function (k) { meta[k] = extra[k]; });
    return addVial(name, flies, meta);
  }

  /* ---------- the lab stock list ---------- */

  var stockFilter = { text: '', heldOnly: true };

  function matchingStocks(limit) {
    var all = FCS.stockList();
    var q = stockFilter.text.trim().toLowerCase();
    var terms = q ? q.split(/\s+/) : [];
    var out = [], i, st, hay;
    for (i = 0; i < all.length && out.length < limit; i++) {
      st = all[i];
      if (stockFilter.heldOnly && !st.s) continue;
      if (terms.length) {
        hay = (st.n + ' ' + st.g + ' ' + st.d + ' ' + st.p).toLowerCase();
        var ok = true;
        for (var t = 0; t < terms.length; t++) { if (hay.indexOf(terms[t]) < 0) { ok = false; break; } }
        if (!ok) continue;
      }
      out.push(st);
    }
    return out;
  }

  /* Which list is in use, and how to change it. */
  function renderStockSource() {
    var d = FCS.stockSource.describe();
    document.getElementById('stockCount').textContent =
      d.held.toLocaleString() + ' held of ' + d.total.toLocaleString();
    document.getElementById('stockSource').textContent = d.own
      ? 'Showing ' + d.name + '.'
      : 'Showing the standard balancer and marker stocks.';
    document.getElementById('btnBuiltInStocks').style.display = d.own ? '' : 'none';
  }

  function stockFileChosen(file) {
    var note = document.getElementById('stockNote');
    if (/\.xlsx?$/i.test(file.name)) {
      /* An .xlsx is a zip archive; reading one here would mean shipping a
         library, and the app is meant to run off the disk with nothing else. */
      note.textContent = file.name + ' is an Excel workbook. Open it in Excel and use File \u2192 Save As '
        + '\u2192 CSV, then load that. Or run data/build_stocks.py, which reads the .xlsx directly and '
        + 'writes data/my-stocks.js for you.';
      return;
    }
    var reader = new root.FileReader();
    reader.onload = function () {
      var read;
      try {
        read = FCS.stockSource.parseFile(String(reader.result), file.name);
      } catch (e) {
        note.textContent = 'Could not read ' + file.name + ': ' + e.message;
        return;
      }
      FCS.stockSource.use(read.rows, file.name);
      note.textContent = read.rows.length.toLocaleString() + ' stocks from ' + file.name
        + ' - ' + read.columns
        + (read.skipped ? '; ' + read.skipped + ' rows had no genotype and were left out' : '')
        + '. Press "save as my-stocks.js" to keep it beside the app.';
    };
    reader.onerror = function () { note.textContent = 'Could not open ' + file.name + '.'; };
    reader.readAsText(file);
  }

  function renderStocks() {
    var list = matchingStocks(60);
    var el2 = document.getElementById('stockList');
    if (!list.length) {
      el2.innerHTML = '<p class="hint">Nothing matches.</p>';
      return;
    }
    el2.innerHTML = list.map(function (st, i) {
      return '<button class="stock-row" data-stock="' + i + '">'
        + '<div class="stock-top"><span class="stock-no">' + esc(st.n) + '</span>'
        + (st.s ? '' : '<span class="stock-gone">not held</span>') + '</div>'
        + '<div class="stock-geno">' + esc(st.g) + '</div>'
        + (st.d ? '<div class="stock-desc">' + esc(st.d) + '</div>' : '')
        + '</button>';
    }).join('');
    el2._list = list;
  }

  /* ---------- rendering ---------- */

  function render() {
    renderRack();
    renderVial();
    renderVialTools();
    renderCrossBar();
    renderCounts();
    renderInspector();
    renderScheme();
    renderGraph();
    renderAllelePanel();
  }

  function renderInspector() {
    FCS.inspector.render(el.inspector, state.inspected || null);
  }

  /* Which generation a vial holds: a stock is parental, the progeny of a first
     cross are F1, of a cross drawing on those F2, and so on. Flies lifted into a
     vial of their own are still the generation they came from. */
  function generations() {
    var sched = FCS.scheme.schedule(state.vials, schemeOpts());
    var byId = {}, label = {};
    state.vials.forEach(function (v) { byId[v.id] = v; });
    function of(v, seen) {
      if (!v || !v.meta) return 'P';
      if (label[v.id]) return label[v.id];
      var out = 'P';
      if (v.meta.kind === 'cross') out = 'F' + (sched.gen[v.id] || 1);
      else if (v.meta.kind === 'kept' && v.meta.pick && byId[v.meta.pick.vialId]) {
        seen = seen || {};
        if (!seen[v.id]) { seen[v.id] = true; out = of(byId[v.meta.pick.vialId], seen); }
      }
      label[v.id] = out;
      return out;
    }
    state.vials.forEach(function (v) { of(v); });
    return label;
  }

  function renderRack() {
    var gen = generations();
    el.rack.innerHTML = state.vials.map(function (v) {
      var byPh = {};
      v.items.forEach(function (it) { byPh[it.phenotype.label] = (byPh[it.phenotype.label] || 0) + 1; });
      var lines = Object.keys(byPh).slice(0, 3).map(function (k) {
        return '<div class="rack-line">' + byPh[k] + ' &times; ' + esc(k) + '</div>';
      }).join('');
      var g = gen[v.id] || 'P';
      return '<div class="rack-row">'
        + '<button class="rack-item' + (v.id === state.activeId ? ' active' : '') + '" data-vial="' + v.id + '">'
        + '<div class="rack-name"><span class="gen-chip ' + esc('gen-' + g) + '">' + esc(g) + '</span>'
        + esc(v.name) + '</div>'
        + '<div class="rack-n">' + v.items.length + ' flies</div>'
        + lines + '</button>'
        + '<button class="rack-del" data-del="' + v.id + '" title="Discard this vial">&times;</button>'
        + '</div>';
    }).join('');
  }

  function removeVial(id) {
    var i, gone = null;
    for (i = 0; i < state.vials.length; i++) {
      if (state.vials[i].id === id) { gone = state.vials.splice(i, 1)[0]; break; }
    }
    if (!gone) return;
    if (state.mother && gone.items.indexOf(state.mother) >= 0) state.mother = null;
    if (state.father && gone.items.indexOf(state.father) >= 0) state.father = null;
    if (state.activeId === id) state.activeId = state.vials.length ? state.vials[state.vials.length - 1].id : null;
  }

  function discardSelected() {
    var v = activeVial();
    if (!v) return;
    v.items = v.items.filter(function (it) { return !it.selected; });
    if (state.mother && v.items.indexOf(state.mother) < 0 && state.mother.selected) state.mother = null;
    if (state.father && v.items.indexOf(state.father) < 0 && state.father.selected) state.father = null;
  }

  function renderVial() {
    var v = activeVial();
    if (!v) {
      el.vialTitle.textContent = 'No vial';
      el.vialMeta.textContent = '';
      el.vialNotes.innerHTML = '';
      view.setFlies([]);
      return;
    }
    var gens = generations();
    el.vialTitle.innerHTML = '<span class="gen-chip ' + esc('gen-' + (gens[v.id] || 'P')) + '">'
      + esc(gens[v.id] || 'P') + '</span>' + esc(v.name);
    var meta = v.meta || {};
    el.vialMeta.innerHTML = meta.kind === 'cross'
      ? 'From ' + genoTextHtml(meta.motherText) + '  \u00d7  ' + genoTextHtml(meta.fatherText)
      : genoTextHtml(meta.genotype || '');

    var notes = [];
    if (meta.compounds && meta.compounds.length) {
      notes.push(meta.compounds.join(', ') + ' is an attached chromosome pair. The engine does not model those, '
        + 'so any cross from this vial will be wrong.');
    }
    if (meta.newMarkers && meta.newMarkers.length) {
      notes.push('Carried as invisible markers, because they are not in the library: ' + meta.newMarkers.join(', ')
        + '. You cannot see them, so track them by the balancer.');
    }
    var missing = [];
    var vialResult = resultOf(v);
    (vialResult && vialResult.linkage ? vialResult.linkage : []).forEach(function (e) {
      notes.push(e.text);
      if (e.kind === 'missing') e.genes.forEach(function (g) {
        if (missing.indexOf(g) < 0) missing.push(g);
      });
    });
    el.vialNotes.innerHTML = notes.map(function (n) {
      return '<div>' + esc(n) + '</div>';
    }).join('')
      + (missing.length
        ? FCS.mapEditor.promptHtml(missing, 'Enter a position and cross the parents again to see recombinants:')
          + '<button id="btnRecross" class="link-btn">cross those parents again</button>'
        : '');

    view.setFlies(v.items);
  }

  function renderVialTools() {
    var v = activeVial();
    var again = document.getElementById('btnAgain');
    if (again) again.style.display = (v && v.meta && v.meta.kind === 'cross') ? '' : 'none';
  }

  function renderCrossBar() {
    function side(which, label) {
      var pick = state[which];
      if (!pick) return '<div class="slot empty"><span>' + label + '</span><em>nothing chosen</em></div>';
      return '<div class="slot"><span>' + label + '</span><strong>' + FCS.inspector.genotypeHtml(pick.fly) + '</strong>'
        + '<em>' + esc(pick.phenotype.label) + '</em></div>';
    }
    el.crossBar.innerHTML = side('mother', '♀ mothers') + '<div class="times">&times;</div>' + side('father', '♂ fathers');
    el.btnCross.disabled = !(state.mother && state.father);
    renderLinkageAhead();
  }

  /* Two markers in cis on the same chromosome in the mother: either the cross is
     about to generate recombinants, or it cannot because a position is missing.
     Better said before the cross than discovered after it. */
  function renderLinkageAhead() {
    var box = document.getElementById('linkAhead');
    if (!box) return;
    if (!state.mother) { box.innerHTML = ''; return; }
    var entries = G.linkage(state.mother.fly);
    if (!entries.length) { box.innerHTML = ''; return; }
    var missing = [];
    entries.forEach(function (e) {
      if (e.kind === 'missing') e.genes.forEach(function (g) {
        if (missing.indexOf(g) < 0) missing.push(g);
      });
    });
    box.innerHTML = entries.map(function (e) { return '<div>' + esc(e.text) + '</div>'; }).join('')
      + (missing.length ? FCS.mapEditor.promptHtml(missing, '') : '');
  }

  /* Every gene on the bench that could carry a map position. */
  function genesOnBench() {
    var ids = [];
    state.vials.forEach(function (v) {
      v.items.forEach(function (it) {
        G.CHRS.forEach(function (chrId) {
          it.fly.chrs[chrId].forEach(function (h) {
            Object.keys(h.alleles).forEach(function (geneId) {
              if (ids.indexOf(geneId) < 0) ids.push(geneId);
            });
          });
        });
      });
    });
    return ids;
  }

  /* Every gene the library knows, plus any of your own that have been named.
     Useful for reading off the classical markers without putting them in a vial. */
  function allGenes() {
    return Object.keys(FCS.data.genes);
  }

  /* Every allele carried by a fly on the bench, whichever vial it is in: this
     is the worksheet's cast list, and the one place to fix anything about them. */
  function allelesOnBench() {
    var out = [], seen = {};
    state.vials.forEach(function (v) {
      v.items.forEach(function (it) {
        G.CHRS.forEach(function (chrId) {
          it.fly.chrs[chrId].forEach(function (h) {
            if (h.balancer) return;               /* a balancer's markers belong to the balancer */
            Object.keys(h.alleles).forEach(function (geneId) {
              var id = h.alleles[geneId];
              if (seen[id] || !FCS.data.alleles[id]) return;
              seen[id] = true;
              out.push(id);
            });
          });
        });
      });
    });
    return out;
  }

  function renderAllelePanel() {
    var box = document.getElementById('allelePanel');
    if (!box) return;
    var onBench = allelesOnBench();
    var mine = onBench.filter(function (id) { return FCS.data.alleles[id].unknown; });
    var count = document.getElementById('alleleCount');
    if (count) {
      count.textContent = onBench.length
        ? onBench.length + ' on the bench' + (mine.length ? ', ' + mine.length + ' yours' : '')
        : '';
    }
    var v = activeVial();
    box.innerHTML = FCS.alleleProps.panelHtml(onBench, (v && v.meta && v.meta.genotype) || '');
  }

  function chiSquare(obs, exp) {
    var x2 = 0, n = 0;
    obs.forEach(function (o, i) {
      if (exp[i] > 0) { x2 += Math.pow(o - exp[i], 2) / exp[i]; n++; }
    });
    return { x2: x2, df: Math.max(0, n - 1) };
  }

  function renderCounts() {
    var v = activeVial();
    if (!v) { el.counts.innerHTML = ''; return; }
    var byKey = {}, order = [];
    v.items.forEach(function (it) {
      var k = it.phenotype.key;
      if (!byKey[k]) { byKey[k] = { label: it.phenotype.label, sex: it.phenotype.sex, n: 0 }; order.push(k); }
      byKey[k].n++;
    });

    var result = resultOf(v);
    var expected = null;
    if (result) {
      expected = {};
      P.classes(result).forEach(function (c) { expected[c.key] = c.p; });
    }

    var total = v.items.length;
    var rows = order.map(function (k) {
      var row = byKey[k];
      var e = expected && expected[k] !== undefined ? expected[k] * total : null;
      return '<tr><td>' + FCS.inspector.sexMark(row.sex) + '</td><td>' + esc(row.label) + '</td>'
        + '<td class="num">' + row.n + '</td>'
        + (expected ? '<td class="num dim">' + (e === null ? '0.0' : e.toFixed(1)) + '</td>' : '')
        + '</tr>';
    });

    if (expected) {
      Object.keys(expected).forEach(function (k) {
        if (!byKey[k]) {
          var cls = P.classes(result).filter(function (c) { return c.key === k; })[0];
          rows.push('<tr class="missing"><td>' + FCS.inspector.sexMark(cls.phenotype.sex) + '</td><td>' + esc(cls.phenotype.label) + '</td>'
            + '<td class="num">0</td><td class="num dim">' + (expected[k] * total).toFixed(1) + '</td></tr>');
        }
      });
    }

    var head = '<tr><th></th><th>Phenotype</th><th class="num">Seen</th>' + (expected ? '<th class="num">Expected</th>' : '') + '</tr>';
    var html = '<table class="counts">' + head + rows.join('') + '</table>';

    if (expected) {
      var keys = Object.keys(expected);
      var o = keys.map(function (k) { return byKey[k] ? byKey[k].n : 0; });
      var e2 = keys.map(function (k) { return expected[k] * total; });
      var cs = chiSquare(o, e2);
      html += '<div class="chi">&chi;&sup2; = ' + cs.x2.toFixed(2) + ' on ' + cs.df + ' df</div>';
      if (result.lost > 0.0001) {
        html += '<div class="lost">' + (result.lost * 100).toFixed(0) + '% of zygotes died before you could see them:<ul>'
          + result.dead.slice(0, 4).map(function (d) {
            return '<li>' + FCS.inspector.genotypeHtml(d.fly) + ' &mdash; ' + esc(d.reason) + '</li>';
          }).join('') + '</ul></div>';
      }
    }
    html += genotypeTable(v, total);
    el.counts.innerHTML = html;
  }

  /* Which vial these parents were picked out of, what they looked like, and how
     often that class comes up there. Recorded at the moment of picking, because
     that is the step of the scheme: "keep the Curly virgins, 1 in 3". */
  function pickRecord(selected) {
    var v = activeVial();
    if (!v) return null;
    var ph = selected[0].phenotype;
    var p = null;
    var vres = resultOf(v);
    if (vres) {
      P.classes(vres).forEach(function (c) { if (c.key === ph.key) p = c.p; });
    }
    /* Flies lifted into a vial of their own still came out of the cross behind
       it, and that is the step the scheme should name. */
    if (v.meta && v.meta.kind === 'kept' && v.meta.pick) {
      return {
        vialId: v.meta.pick.vialId, fromName: v.meta.pick.fromName,
        label: ph.label, sex: ph.sex,
        p: v.meta.pick.p, n: selected.length
      };
    }
    return {
      vialId: v.id, fromName: v.name, label: ph.label, sex: ph.sex,
      p: p, n: selected.length
    };
  }

  /* Lifting flies out of a vial into one of their own: what you do with a brush
     once the pile you want is sorted out. The flies move rather than copy. */
  function keepSelected() {
    var v = activeVial();
    if (!v) return;
    var sel = selectedItems();
    if (!sel.length) { root.alert('Select the flies you want to keep first.'); return; }

    var labels = {};
    sel.forEach(function (it) { labels[it.phenotype.label] = true; });
    var names = Object.keys(labels);
    var pick = pickRecord(sel);
    if (names.length > 1 && pick) pick.p = null;      /* a mixed handful has no one frequency */

    var kept = sel.slice();
    v.items = v.items.filter(function (it) { return kept.indexOf(it) < 0; });

    var nv = addVial((names.length === 1 ? names[0] : 'kept') + ' from ' + v.name,
      kept.map(function (it) { return it.fly; }),
      { kind: 'kept', pick: pick, fromName: v.name, label: names.join(', ') });
    nv.items.forEach(function (it) { it.selected = false; });
    state.inspected = null;
    render();
  }

  /* The scheme so far, in its own panel beside the bench: the crosses that led
     to the vial you are looking at, in order, and what you kept out of each. */
  /* The same plan the panel lists, drawn. Only built while its tab is showing:
     no point laying out a graph nobody is looking at. */
  function renderGraph() {
    var host = document.getElementById('graphHost');
    var pane = document.getElementById('graphBody');
    if (!host || !pane || pane.hidden) return;
    var steps = FCS.scheme.plan(state.vials, schemeOpts());
    if (!steps.length) {
      host.innerHTML = '<p class="hint">No crosses yet. Set one up on the bench and it appears here.</p>';
      return;
    }
    var v = activeVial();
    /* Flies lifted into a vial of their own still belong to the cross they came
       out of, so that is what the graph should light up. */
    var anchor = v;
    if (v && v.meta && v.meta.kind === 'kept' && v.meta.pick) {
      state.vials.forEach(function (x) { if (x.id === v.meta.pick.vialId) anchor = x; });
    }
    var here = anchor ? FCS.scheme.chain(anchor.id, state.vials).map(function (x) { return x.id; }) : [];
    host.innerHTML = FCS.graph.svg(steps, here, anchor ? anchor.id : null);
  }

  /* How long a generation takes, at the temperature the flies are kept at.
     Roughly: ten days egg to adult at 25 degrees, plus time to collect virgins;
     everything slows down as it cools, which is what the 18 degree shelf is for.
     The number stays editable - this only sets a sensible starting point. */
  var GENERATION_DAYS = { 18: 28, 22: 19, 25: 14, 29: 11 };

  function schemeOpts() {
    return {
      start: state.startDate, days: state.genDays,
      temperature: state.temperature, date: new Date().toDateString()
    };
  }

  function renderScheme() {
    var body = document.getElementById('schemeBody');
    var count = document.getElementById('schemeCount');
    var tools = document.querySelector('.scheme-tools');
    if (!body) return;

    var v = activeVial();
    /* The plan is the whole bench, not one thread through it. Adding a vial used
       to empty this panel, because it followed whichever vial was selected; and
       two schemes running side by side had nowhere to both be. */
    var list = state.schemeAll
      ? FCS.scheme.plan(state.vials, schemeOpts())
      : (v ? FCS.scheme.steps(v.id, state.vials, schemeOpts()) : []);
    var chainIds = v ? FCS.scheme.chain(v.id, state.vials).map(function (x) { return x.id; }) : [];

    count.textContent = list.length
      ? list.length + (list.length === 1 ? ' cross' : ' crosses')
        + (state.schemeAll ? ' on the bench' : ' \u2014 ' + (v ? v.name : ''))
      : '';
    if (tools) tools.style.display = list.length ? '' : 'none';

    if (!list.length) {
      body.innerHTML = '<p class="hint">Nothing crossed yet. Choose mothers and fathers, press '
        + '"Set up the cross", and every cross lands here: both parents, which vial each came out of, '
        + 'the class you kept with how often it comes up, and the day it goes in.</p>';
      return;
    }

    body.innerHTML = '<ol class="scheme-list">' + list.map(function (st) {
      function side(which, mark) {
        var from = st[which].from;
        return '<div class="scheme-side">' + mark + ' <code>' + genoTextHtml(st[which].genotype) + '</code>'
          + '<span class="dim"> ' + (from && from.fromName
            ? 'from ' + (from.step ? 'step ' + from.step + ', ' : '') + esc(from.fromName)
              + (from.p ? ', ' + (from.p * 100).toFixed(1) + '% class' : '')
            : 'a stock') + '</span></div>';
      }
      var kept = st.kept.map(function (k) {
        return '<div class="scheme-keep">keep the ' + (k.sex === 'F' ? 'virgin females' : 'males')
          + ' that are <strong>' + esc(k.label) + '</strong>'
          + (k.p ? ' &mdash; ' + (k.p * 100).toFixed(1) + '%' + oneIn(k.p) : '') + '</div>';
      }).join('');
      var notes = st.notes.length ? '<div class="scheme-note">' + esc(st.notes[0]) + '</div>' : '';
      var here = chainIds.indexOf(st.id) >= 0;
      return '<li class="' + (here ? 'scheme-here' : '') + '">'
        + '<div class="scheme-head">' + esc(st.name)
        + '<span class="scheme-when">'
        + '<input type="date" data-when="' + st.id + '" value="' + esc(st.dateValue) + '">'
        + (st.fixed
          ? ' <button type="button" class="link-btn" data-unpin="' + st.id + '">let it follow</button>'
          : ' <span class="dim">gen ' + st.generation + '</span>')
        + '</span></div>'
        + side('mother', '\u2640') + side('father', '\u2642') + kept + notes + '</li>';
    }).join('') + '</ol>'
      + '<label class="held"><input type="checkbox" id="schemeAll"'
      + (state.schemeAll ? ' checked' : '') + '> the whole bench, not just this vial</label>';
  }

  function schemeText() {
    var v = activeVial();
    if (state.schemeAll) return FCS.scheme.toMarkdown(null, state.vials, schemeOpts());
    return v ? FCS.scheme.toMarkdown(v.id, state.vials, schemeOpts()) : '';
  }

  /* A genotype that is already text - saved in a vial's meta, or read off the
     plan - coloured the same way as a live one: balancer names greyed, the rest
     in ordinary text. */
  function genoTextHtml(text) {
    return String(text || '').split(';').map(function (seg) {
      return seg.split('/').map(function (side) {
        return '<span class="' + (FCS.parse.isYourSide(side) ? 'geno-own' : 'geno-std') + '">'
          + esc(side.trim()) + '</span>';
      }).join('<span class="geno-slash">/</span>');
    }).join('<span class="geno-sep">; </span>');
  }

  function oneIn(p) {
    if (!p || p <= 0) return '';
    var n = Math.round(1 / p);
    return n > 1 ? ', about 1 in ' + n : '';
  }

  /* Every genotype the cross can give, under the phenotype it hides behind.
     Two flies that look identical are often the two genotypes you care about
     telling apart, and this is where that becomes visible. */
  function genotypeTable(v, total) {
    var seen = {};
    v.items.forEach(function (it) {
      var k = G.genotypeString(it.fly) + '|' + it.phenotype.sex;
      seen[k] = (seen[k] || 0) + 1;
    });

    var res = resultOf(v);
    if (!res) {
      var rows = Object.keys(seen).sort(function (a, b) { return seen[b] - seen[a]; });
      if (!rows.length) return '';
      return '<details class="geno-list"><summary>Genotypes in this vial ('
        + rows.length + ')</summary><table class="counts">'
        + '<tr><th></th><th>Genotype</th><th class="num">Flies</th></tr>'
        + rows.map(function (k) {
          var bits = k.split('|');
          return '<tr><td>' + FCS.inspector.sexMark(bits[1]) + '</td><td class="geno">' + genoTextHtml(bits[0])
            + '</td><td class="num">' + seen[k] + '</td></tr>';
        }).join('') + '</table></details>';
    }

    var classes = P.classes(res);
    var n = 0;
    classes.forEach(function (c) { n += c.genotypes.length; });

    var body = classes.map(function (c) {
      var head = '<tr class="geno-head"><td>' + FCS.inspector.sexMark(c.phenotype.sex) + '</td>'
        + '<td colspan="2">' + esc(c.phenotype.label) + '</td>'
        + '<td class="num">' + (c.p * 100).toFixed(1) + '%</td>'
        + '<td class="num">' + (c.genotypes.reduce(function (t, g) {
          return t + (seen[G.genotypeString(g.fly) + '|' + c.phenotype.sex] || 0);
        }, 0)) + '</td></tr>';
      var kids = c.genotypes.slice().sort(function (a, b) { return b.p - a.p; }).map(function (g) {
        var text = G.genotypeString(g.fly);
        return '<tr><td></td><td colspan="2" class="geno">' + FCS.inspector.genotypeHtml(g.fly) + '</td>'
          + '<td class="num dim">' + (g.p * 100).toFixed(1) + '%</td>'
          + '<td class="num dim">' + (seen[text + '|' + c.phenotype.sex] || 0) + '</td></tr>';
      }).join('');
      return head + kids;
    }).join('');

    return '<details class="geno-list"><summary>Every genotype this cross can give ('
      + n + ' in ' + classes.length + ' phenotype' + (classes.length === 1 ? '' : 's') + ')</summary>'
      + '<table class="counts">'
      + '<tr><th></th><th colspan="2">Phenotype, then the genotypes under it</th>'
      + '<th class="num">Expected</th><th class="num">Seen</th></tr>'
      + body + '</table>'
      + '<p class="hint">Percentages are of the flies that survive, so they add to 100 across the whole vial. '
      + 'Seen counts are out of the ' + total + ' drawn into this vial \u2014 a sample, so they wander about '
      + 'the expected value.</p></details>';
  }

  /* A gene of yours has been moved to another chromosome, so the flies already
     on the bench have to follow: the allele leaves the old chromosome and joins
     the same homologue of the new one. Flies are shared between vials, so each
     one is touched once. */
  function relocateAllele(move) {
    var done = [], lost = 0;
    state.vials.forEach(function (v) {
      v.items.forEach(function (it) {
        var f = it.fly;
        if (done.indexOf(f) >= 0) return;
        done.push(f);
        [0, 1].forEach(function (i) {
          var from = f.chrs[move.from] && f.chrs[move.from][i];
          if (!from || !from.alleles[move.geneId]) return;
          var aid = from.alleles[move.geneId];
          delete from.alleles[move.geneId];
          var to = f.chrs[move.to] && f.chrs[move.to][i];
          if (to && to.chr !== 'Y') to.alleles[move.geneId] = aid;
          else lost++;
        });
      });
    });
    var said = document.getElementById('stockError');
    if (said) {
      said.textContent = move.symbol + ' moved to chromosome ' + move.to
        + '. Flies on the bench carry it there now'
        + (lost ? ', except in ' + lost + ' males where that homologue is the Y' : '')
        + '. Its map position was cleared, since a distance on one chromosome means nothing on another.';
    }
  }

  /* An allele deleted from the library has to leave the flies too, or they are
     carrying something nothing can describe. */
  function forgetAllele(gone) {
    var done = [], touched = 0;
    state.vials.forEach(function (v) {
      v.items.forEach(function (it) {
        var f = it.fly;
        if (done.indexOf(f) >= 0) return;
        done.push(f);
        G.CHRS.forEach(function (chrId) {
          f.chrs[chrId].forEach(function (h) {
            Object.keys(h.alleles).forEach(function (geneId) {
              if (h.alleles[geneId] !== gone.symbol) return;
              delete h.alleles[geneId];
              touched++;
            });
          });
        });
      });
    });
    var said = document.getElementById('geneAdded');
    if (said) {
      said.textContent = gone.symbol + ' deleted'
        + (touched ? ', and taken off ' + touched + ' chromosome' + (touched === 1 ? '' : 's') + ' on the bench' : '')
        + '. Type it again and it starts fresh.';
    }
  }

  /* ---------- keeping the bench ---------- */

  var BENCH_KEY = 'flyCrossSim.bench.v1';

  function benchJson() { return FCS.bench.pack(state); }

  /* Saving is deliberately manual. An automatic save wrote the whole bench -
     every fly of every vial - back to browser storage as you worked, and read it
     again at startup; with a few vials of a few hundred flies that was enough to
     make opening the page crawl. "save" and "open" write and read a file when
     you ask, and nothing happens behind your back. The old automatic copy is
     cleared out on the way past. */
  function forgetAutoSave() {
    try { root.localStorage.removeItem(BENCH_KEY); } catch (e) { /* storage off */ }
  }

  function restoreBench(data, note) {
    var back = FCS.bench.unpack(data);
    state.vials = back.vials.map(function (v) {
      return {
        id: v.id, name: v.name, meta: v.meta,
        items: v.items.map(function (it) {
          var item = makeItem(it.fly);
          item.selected = it.selected;
          return item;
        })
      };
    });
    state.nextId = back.nextId;
    state.sampleSize = back.sampleSize;
    if (back.startDate) {
      state.startDate = back.startDate;
      var sb = document.getElementById('schemeStart');
      if (sb) sb.value = back.startDate;
    }
    if (back.genDays) {
      state.genDays = back.genDays;
      var db = document.getElementById('schemeDays');
      if (db) db.value = back.genDays;
    }
    if (back.temperature) {
      state.temperature = back.temperature;
      var tb = document.getElementById('schemeTemp');
      if (tb) tb.value = String(back.temperature);
    }
    state.activeId = back.activeId;
    state.mother = state.father = null;
    state.motherFrom = state.fatherFrom = null;
    state.inspected = null;
    renderBalancers();
    render();
    if (note) {
      document.getElementById('benchNote').textContent = note
        + (back.saved ? ' (saved ' + new Date(back.saved).toLocaleString() + ')' : '');
    }
  }

  /* ---------- lab corrections ---------- */

  function refreshPhenotypes() {
    state.vials.forEach(function (v) {
      v.items.forEach(function (it) { it.phenotype = P.of(it.fly); });
    });
  }

  function rebuildBalancer(balancerId) {
    state.vials.forEach(function (v) {
      v.items.forEach(function (it) { G.refreshBalancer(it.fly, balancerId); });
    });
    refreshPhenotypes();
  }

  function renderBalancers() {
    var host = document.getElementById('balList');
    if (!host) return;
    var choices = FCS.overrides.markerChoices();
    host.innerHTML = Object.keys(FCS.data.balancers).map(function (id) {
      var b = FCS.data.balancers[id];
      var chips = b.markers.map(function (aid) {
        var a = FCS.data.alleles[aid];
        return '<span class="chip-marker">' + esc(a ? a.symbol : aid)
          + '<button data-drop="' + esc(id) + '|' + esc(aid) + '" title="Remove">&times;</button></span>';
      }).join('');
      var add = choices.filter(function (aid) { return b.markers.indexOf(aid) < 0; }).map(function (aid) {
        return '<option value="' + esc(aid) + '">' + esc(FCS.data.alleles[aid].symbol) + '</option>';
      }).join('');
      return '<div class="bal-row"><span class="bal-name">' + esc(id) + '</span>'
        + '<span class="bal-chr">chr ' + esc(b.chr) + '</span>'
        + '<span class="bal-chips">' + (chips || '<em>none</em>') + '</span>'
        + '<select data-add="' + esc(id) + '"><option value="">add\u2026</option>' + add + '</select>'
        + '</div>';
    }).join('');
  }

  /* ---------- actions ---------- */

  function selectedItems() {
    var v = activeVial();
    return v ? v.items.filter(function (it) { return it.selected; }) : [];
  }

  function doCross(motherFly, fatherFly, from, name) {
    var mum = motherFly || (state.mother && state.mother.fly);
    var dad = fatherFly || (state.father && state.father.fly);
    if (!mum || !dad) return;
    var result;
    try {
      result = G.cross(mum, dad);
    } catch (e) {
      root.alert(e.message); return;
    }
    var drawn = G.sample(result, state.sampleSize);
    var v = addVial(name || ('Cross ' + (state.vials.filter(function (x) {
      return x.meta && x.meta.kind === 'cross';
    }).length + 1)),
      drawn.map(function (d) { return d.fly; }),
      {
        kind: 'cross', result: result,
        motherFly: mum, fatherFly: dad,
        motherText: G.genotypeString(mum),
        fatherText: G.genotypeString(dad),
        from: from || { mother: state.motherFrom || null, father: state.fatherFrom || null },
        classes: P.classes(result).map(function (c) {
          return { label: c.phenotype.label, sex: c.phenotype.sex, p: c.p };
        })
      });
    state.mother = null; state.father = null;
    state.motherFrom = null; state.fatherFrom = null;
    state.activeId = v.id;
    /* A fresh vial arrives on the pad, sorted into piles: that is the moment you
       want to look at it, not watch it run around. */
    view.anaesthetise(true);
    el.btnPad.textContent = 'Let them wake up';
    el.btnPad.classList.add('on');
    render();
  }

  /* ---------- starting stocks ---------- */

  var STARTERS = [
    ['Oregon-R (wild type)', '+', { F: 12, M: 12 }],
    ['w[1118]', 'w', { F: 12, M: 12 }],
    ['vestigial', 'vg', { F: 12, M: 12 }],
    ['ebony', 'e', { F: 12, M: 12 }],
    ['black vestigial', 'b,vg', { F: 12, M: 12 }],
    ['y sn f (X mapping)', 'y,sn,f', { F: 12, M: 12 }],
    ['CyO balancer', 'CyO/+', { F: 12, M: 12 }],
    ['TM3,Sb balancer', 'TM3,Sb/+', { F: 12, M: 12 }],
    ['Bar', 'B/+', { F: 12, M: 0 }],
    ['purple dumpy', 'pr,dp', { F: 12, M: 12 }]
  ];

  function init() {
    G = FCS.genetics; P = FCS.phenotype; esc = FCS.inspector.esc;

    ['rack', 'vialTitle', 'vialMeta', 'vialNotes', 'counts', 'inspector', 'crossBar'].forEach(function (id) {
      el[id] = document.getElementById(id);
    });
    el.btnPad = document.getElementById('btnPad');
    el.btnCross = document.getElementById('btnCross');
    el.canvas = document.getElementById('vialCanvas');

    FCS.stockSource.load();
    FCS.stockSource.onChange(function () {
      /* The planner is parked and not loaded; when it comes back it will want
         to know the list changed under it. */
      if (FCS.planner && FCS.planner.forgetStocks) FCS.planner.forgetStocks();
      renderStockSource();
      renderStocks();
    });

    FCS.mapEditor.init(function () { render(); });
    FCS.alleleProps.init(function (what) {
      if (what && what.moved) relocateAllele(what.moved);
      if (what && what.forgotten) forgetAllele(what.forgotten);
      refreshPhenotypes();
      render();
    });

    FCS.overrides.load();
    FCS.overrides.onChange(function () {
      refreshPhenotypes();
      renderBalancers();
      render();
    });

    view = new FCS.VialView(el.canvas);
    view.groupBy = 'genotype';
    view.asleep = true;
    view.onPick = function (i) {
      var v = activeVial(); if (!v) return;
      var it = v.items[i];
      it.selected = !it.selected;
      state.lastPickedKey = it.phenotype.key;
      state.inspected = it;
      renderInspector();
      renderCounts();
    };
    view.start();

    el.rack.addEventListener('click', function (ev) {
      var del = ev.target.closest('[data-del]');
      if (del) { removeVial(del.getAttribute('data-del')); render(); return; }
      var b = ev.target.closest('[data-vial]');
      if (!b) return;
      state.activeId = b.getAttribute('data-vial');
      render();
    });

    document.getElementById('btnDiscard').addEventListener('click', function () {
      discardSelected();
      render();
    });

    document.getElementById('btnEmpty').addEventListener('click', function () {
      var v = activeVial();
      if (!v) return;
      removeVial(v.id);
      render();
    });

    document.getElementById('btnClearAll').addEventListener('click', function () {
      if (!state.vials.length) return;
      if (!root.confirm('Discard every vial on the bench?')) return;
      state.vials.length = 0;
      state.activeId = null;
      state.mother = null; state.father = null;
      state.inspected = null;
      render();
    });

    el.btnPad.addEventListener('click', function () {
      view.anaesthetise(!view.asleep);
      el.btnPad.textContent = view.asleep ? 'Let them wake up' : 'Anaesthetise';
      el.btnPad.classList.toggle('on', view.asleep);
    });

    document.getElementById('btnSelectLike').addEventListener('click', function () {
      var v = activeVial(); if (!v || !state.lastPickedKey) return;
      v.items.forEach(function (it) { if (it.phenotype.key === state.lastPickedKey) it.selected = true; });
      renderCounts();
    });

    document.getElementById('btnClearSel').addEventListener('click', function () {
      var v = activeVial(); if (!v) return;
      v.items.forEach(function (it) { it.selected = false; });
      renderCounts();
    });

    document.getElementById('btnMother').addEventListener('click', function () {
      var sel = selectedItems().filter(function (it) { return it.phenotype.sex === 'F'; });
      if (!sel.length) { root.alert('Select at least one female first.'); return; }
      state.mother = sel[0];
      state.motherFrom = pickRecord(sel);
      renderCrossBar();
    });

    document.getElementById('btnFather').addEventListener('click', function () {
      var sel = selectedItems().filter(function (it) { return it.phenotype.sex === 'M'; });
      if (!sel.length) { root.alert('Select at least one male first.'); return; }
      state.father = sel[0];
      state.fatherFrom = pickRecord(sel);
      renderCrossBar();
    });

    el.btnCross.addEventListener('click', function () { doCross(); });

    document.getElementById('btnKeep').addEventListener('click', keepSelected);

    /* The same cross gives you more than one vial at the bench, and a class of
       1 in 200 will not be in every hundred flies. */
    document.getElementById('btnAgain').addEventListener('click', function () {
      var v = activeVial();
      if (!v || !v.meta || v.meta.kind !== 'cross') return;
      /* Another vial of the SAME cross, not a new step: named so the scheme
         does not read as though you crossed twice. */
      var base = v.name.replace(/, vial \d+$/, '');
      var k = state.vials.filter(function (x) { return x.name.replace(/, vial \d+$/, '') === base; }).length;
      doCross(v.meta.motherFly, v.meta.fatherFly, v.meta.from, base + ', vial ' + (k + 1));
    });

    document.getElementById('btnSaveBench').addEventListener('click', function () {
      var text = JSON.stringify(benchJson(), null, 1);
      var blob = new root.Blob([text], { type: 'application/json' });
      var url = root.URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'fly-bench.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 1000);
      document.getElementById('benchNote').textContent = 'Bench written to fly-bench.json.';
    });

    document.getElementById('benchFile').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      var reader = new root.FileReader();
      reader.onload = function () {
        try {
          restoreBench(JSON.parse(String(reader.result)), 'Opened ' + file.name);
        } catch (e) {
          document.getElementById('benchNote').textContent = 'Could not open ' + file.name + ': ' + e.message;
        }
      };
      reader.readAsText(file);
    });

    document.getElementById('schemeBody').addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.id === 'schemeAll') { state.schemeAll = t.checked; renderScheme(); return; }
      if (!t.hasAttribute('data-when')) return;
      var vial = state.vials.filter(function (x) { return x.id === t.getAttribute('data-when'); })[0];
      if (!vial || !vial.meta) return;
      /* Pinning one cross to a day moves everything that waits on it. */
      vial.meta.setUpOn = t.value || null;
      renderScheme();
    });

    document.getElementById('schemeBody').addEventListener('click', function (ev) {
      var u = ev.target.closest('[data-unpin]');
      if (!u) return;
      var vial = state.vials.filter(function (x) { return x.id === u.getAttribute('data-unpin'); })[0];
      if (!vial || !vial.meta) return;
      vial.meta.setUpOn = null;
      renderScheme();
    });

    var startBox = document.getElementById('schemeStart');
    var daysBox = document.getElementById('schemeDays');
    var today = new Date();
    state.startDate = [today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')].join('-');
    startBox.value = state.startDate;
    startBox.addEventListener('change', function () {
      state.startDate = startBox.value || null;
      renderScheme();
    });
    var tempBox = document.getElementById('schemeTemp');
    tempBox.value = String(state.temperature);
    tempBox.addEventListener('change', function () {
      state.temperature = parseInt(tempBox.value, 10) || 25;
      state.genDays = GENERATION_DAYS[state.temperature] || 14;
      daysBox.value = state.genDays;
      renderScheme();
    });

    daysBox.addEventListener('change', function () {
      state.genDays = Math.max(7, Math.min(60, parseInt(daysBox.value, 10) || 14));
      daysBox.value = state.genDays;
      renderScheme();
    });

    document.getElementById('btnSaveScheme').addEventListener('click', function () {
      var text = schemeText();
      if (!text) return;
      var blob = new root.Blob([text], { type: 'text/markdown' });
      var url = root.URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'crossing-scheme.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 1000);
    });

    document.getElementById('btnCopyScheme').addEventListener('click', function (ev) {
      var text = schemeText();
      if (!text) return;
      var said = ev.target;
      function done() { said.textContent = 'copied'; root.setTimeout(function () { said.textContent = 'copy'; }, 1500); }
      if (root.navigator.clipboard && root.navigator.clipboard.writeText) {
        root.navigator.clipboard.writeText(text).then(done, fallback);
      } else fallback();
      function fallback() {
        /* Off the disk, the clipboard API is often refused. A hidden textarea
           and the old execCommand still works everywhere. */
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { /* nothing more to try */ }
        document.body.removeChild(ta);
      }
    });

    document.getElementById('btnPrintScheme').addEventListener('click', function () {
      var text = schemeText();
      if (!text) return;
      var w = root.open('', '_blank');
      if (!w) return;
      w.document.write('<title>Crossing scheme</title>'
        + '<style>body{font:13px/1.5 -apple-system,Segoe UI,sans-serif;margin:32px;max-width:40em}'
        + 'pre{white-space:pre-wrap;font:12px ui-monospace,Menlo,monospace}</style>'
        + '<pre>' + FCS.inspector.esc(text) + '</pre>');
      w.document.close();
      w.focus();
      w.print();
    });

    el.vialNotes.addEventListener('click', function (ev) {
      if (!ev.target.closest('#btnRecross')) return;
      var v = activeVial();
      if (v && v.meta && v.meta.motherFly) doCross(v.meta.motherFly, v.meta.fatherFly, v.meta.from);
    });

    el.inspector.addEventListener('change', function (ev) {
      var look = ev.target.getAttribute && ev.target.getAttribute('data-look');
      var dom = ev.target.getAttribute && ev.target.getAttribute('data-dom');
      if (look) {
        var domSel = el.inspector.querySelector('[data-dom="' + look.replace(/"/g, '\\"') + '"]');
        FCS.overrides.setLook(look, ev.target.value, domSel ? domSel.value : 'recessive');
      } else if (dom) {
        var lookSel = el.inspector.querySelector('[data-look="' + dom.replace(/"/g, '\\"') + '"]');
        FCS.overrides.setLook(dom, lookSel ? lookSel.value : '', ev.target.value);
      }
    });

    document.getElementById('balList').addEventListener('click', function (ev) {
      var drop = ev.target.closest && ev.target.closest('[data-drop]');
      if (!drop) return;
      var bits = drop.getAttribute('data-drop').split('|');
      var b = FCS.data.balancers[bits[0]];
      FCS.overrides.setMarkers(bits[0], b.markers.filter(function (m) { return m !== bits[1]; }));
      rebuildBalancer(bits[0]);
      render();
    });

    document.getElementById('balList').addEventListener('change', function (ev) {
      var id = ev.target.getAttribute && ev.target.getAttribute('data-add');
      if (!id || !ev.target.value) return;
      var b = FCS.data.balancers[id];
      FCS.overrides.setMarkers(id, b.markers.concat([ev.target.value]));
      rebuildBalancer(id);
      render();
    });

    document.getElementById('btnSaveLab').addEventListener('click', function () {
      FCS.overrides.download();
    });

    /* The "work backwards" pane is parked: engine/planner.js, ui/planpane.js and
       ui/targetbuilder.js are still in the folder with their tests, but nothing
       loads them. The derivation needs rethinking before it goes back in. */

    var benchBody = document.getElementById('benchBody');
    var graphBody = document.getElementById('graphBody');
    var tabBench = document.getElementById('tabBench');
    var tabGraph = document.getElementById('tabGraph');
    function showPane(which) {
      var onGraph = which === 'graph';
      graphBody.hidden = !onGraph;
      benchBody.hidden = onGraph;
      tabGraph.classList.toggle('on', onGraph);
      tabBench.classList.toggle('on', !onGraph);
      if (onGraph) renderGraph(); else render();
    }
    tabBench.addEventListener('click', function () { showPane('bench'); });
    tabGraph.addEventListener('click', function () { showPane('graph'); });

    document.getElementById('graphHost').addEventListener('click', function (ev) {
      var n = ev.target.closest('[data-node]');
      if (!n) return;
      state.activeId = n.getAttribute('data-node');
      renderGraph();
      renderScheme();
    });


    /* Adding a gene the library has never heard of, with its position, without
       having to write a genotype first. It is invisible, like every allele of
       your own: you track it by the balancer, and now it can recombine too. */
    document.getElementById('newGene').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var said = document.getElementById('geneAdded');
      var sym = document.getElementById('geneSymbol').value.trim();
      var chr = document.getElementById('geneChr').value;
      var pos = document.getElementById('genePos').value.trim();
      var approx = document.getElementById('geneApprox').checked;
      if (!sym) return;

      var known = FCS.parse.lookupAllele(sym);
      var geneId;
      if (known) {
        geneId = FCS.data.alleles[known].gene;
        var where = FCS.data.genes[geneId];
        if (where.chr !== chr) {
          if (!where.unknown) {
            said.textContent = FCS.data.alleles[known].symbol + ' is a library gene, on chromosome '
              + where.chr + '. A gene cannot be on two chromosomes, so nothing was changed.';
            return;
          }
          var from = where.chr;
          FCS.data.moveGene(geneId, chr);
          relocateAllele({ geneId: geneId, symbol: sym, from: from, to: chr });
        }
      } else {
        geneId = FCS.data.genes[FCS.data.alleles[FCS.data.ensureAllele(sym, chr)].gene].id;
      }
      if (FCS.data.genes[geneId].onBalancerOnly) {
        said.textContent = sym + ' is a balancer marker, so it has no distance to set.';
        return;
      }
      if (pos !== '') FCS.data.setGenePosition(geneId, pos, { approx: approx });
      FCS.overrides.save();

      var showAll = document.getElementById('alleleShowAll');
      if (showAll && !showAll.checked) {
        showAll.checked = true;
        showAll.dispatchEvent(new root.Event('change', { bubbles: true }));
      }
      refreshPhenotypes();
      render();
      said.textContent = sym + ' is on chromosome ' + chr
        + (pos !== '' ? ' at ' + pos + ' cM' + (approx ? ', marked as an estimate' : '') : ', with no position yet')
        + '. It is invisible, so write it over a balancer: ' + sym
        + (chr === '2' ? '/CyO' : chr === '3' ? '/TM6B' : chr === 'X' ? '/FM7a' : '/+') + '.';
      document.getElementById('geneSymbol').value = '';
      document.getElementById('genePos').value = '';
    });

    document.getElementById('groupPad').addEventListener('change', function (ev) {
      view.setGrouping(ev.target.value);
    });

    document.getElementById('sampleSize').addEventListener('change', function (ev) {
      state.sampleSize = parseInt(ev.target.value, 10) || 100;
    });

    document.getElementById('newStock').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var text = document.getElementById('stockGenotype').value.trim();
      if (!text) return;
      var check = FCS.parse.parse(text, 'F');
      if (!check.ok) {
        document.getElementById('stockError').textContent = 'Could not read: ' + check.unknown.join(', ');
        return;
      }
      document.getElementById('stockError').textContent = '';
      stockVial(text, text, { F: 12, M: 12 });
      document.getElementById('stockGenotype').value = '';
      render();
    });

    renderStockSource();
    document.getElementById('stockSearch').addEventListener('input', function (ev) {
      stockFilter.text = ev.target.value;
      renderStocks();
    });
    document.getElementById('heldOnly').addEventListener('change', function (ev) {
      stockFilter.heldOnly = ev.target.checked;
      renderStocks();
    });
    document.getElementById('stockFile').addEventListener('change', function (ev) {
      if (ev.target.files && ev.target.files[0]) stockFileChosen(ev.target.files[0]);
      ev.target.value = '';
    });
    document.getElementById('btnStockTemplate').addEventListener('click', function () {
      var text = 'Stock #,Genotype,Description,Project,In stock\n'
        + 'JR417,"w; cnn[f04547]/CyO",from Bloomington,centriole,yes\n'
        + 'JR418,"w; +; Sas-6/TM6B",,centriole,yes\n'
        + 'JR419,"w; Sco/CyO; Dr/TM6C",double balancer,tools,no\n';
      var blob = new root.Blob([text], { type: 'text/csv' });
      var url = root.URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'fly-list-template.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 1000);
      document.getElementById('stockNote').textContent =
        'Template written to fly-list-template.csv. Replace the three rows with your own and load it back.';
    });

    document.getElementById('btnSaveStocks').addEventListener('click', function () {
      FCS.stockSource.download();
    });
    document.getElementById('btnBuiltInStocks').addEventListener('click', function () {
      FCS.stockSource.useBuiltIn();
      document.getElementById('stockNote').textContent = 'Back to the standard balancer stocks.';
    });
    document.getElementById('stockList').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-stock]');
      if (!b) return;
      var list = document.getElementById('stockList')._list || [];
      var st = list[parseInt(b.getAttribute('data-stock'), 10)];
      if (!st) return;
      try {
        stockVial(vialName(st), st.g, { F: 12, M: 12 }, { stockNumber: st.n, description: st.d });
      } catch (e) {
        root.alert('Could not read that genotype: ' + e.message);
        return;
      }
      render();
    });
    renderStocks();

    document.getElementById('starters').innerHTML = STARTERS.map(function (s, i) {
      return '<button class="chip" data-starter="' + i + '">' + esc(s[0]) + '</button>';
    }).join('');
    document.getElementById('starters').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-starter]');
      if (!b) return;
      var s = STARTERS[parseInt(b.getAttribute('data-starter'), 10)];
      stockVial(s[0], s[1], s[2]);
      render();
    });

    renderBalancers();

    forgetAutoSave();
    el.btnPad.textContent = 'Let them wake up';
    var groupPick = document.getElementById('groupPad');
    if (groupPick) groupPick.value = 'genotype';
    stockVial('Oregon-R (wild type)', '+', { F: 12, M: 12 });
    stockVial('w[1118]', 'w', { F: 12, M: 12 });
    render();
    document.getElementById('benchNote').textContent =
      'The bench starts empty each time. "save" writes it to a file; "open" brings one back.';
  }

  FCS.app = { init: init, state: state, view: function () { return view; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
