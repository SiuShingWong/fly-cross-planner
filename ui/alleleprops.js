/* Fly Cross Planner - the alleles on your worksheet.
 *
 * One place for everything the app knows about an allele, because the things
 * you want to change about one are all the same kind of thing: which
 * chromosome it is on, whether homozygotes live, what it looks like if
 * anything, where it sits on the map, and what else is written beside it.
 *
 * Your own alleles can be moved, edited and deleted; the library's cannot be
 * moved or deleted, but their map positions are yours to correct. Everything
 * set here is remembered with the other lab corrections and written into the
 * lab file, so it is said once and holds wherever that allele turns up.
 *
 * Exports FCS.alleleProps — init, panelHtml, withCis
 * Needs FCS.data, FCS.parse, FCS.overrides, FCS.mapEditor and FCS.inspector.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};
  var esc, onChange = null, lastGenotype = '', showAll = false;

  var LETHAL = [
    { value: 'none', label: 'not lethal' },
    { value: 'recessive', label: 'homozygous lethal' },
    { value: 'dominant', label: 'dominant lethal' }
  ];

  function geneOf(symbol) {
    var a = FCS.data.alleles[symbol];
    return a ? FCS.data.genes[a.gene] : null;
  }

  function mappable(g) {
    if (!g || g.onBalancerOnly) return false;
    var chr = FCS.data.chromosomes[g.chr];
    return !!(chr && chr.recombines);
  }

  /* ---------- one allele ---------- */

  function blockHtml(symbol) {
    var a = FCS.data.alleles[symbol];
    var g = geneOf(symbol);
    if (!a || !g) return '';
    var mine = !!a.unknown;

    var head = '<div class="props-head"><span class="sym">' + esc(symbol) + '</span>'
      + (mine
        ? '<select data-chr="' + esc(symbol) + '" title="which chromosome it is on">'
          + ['X', '2', '3', '4'].map(function (c) {
            return '<option value="' + c + '"' + (g.chr === c ? ' selected' : '') + '>chromosome ' + c + '</option>';
          }).join('') + '</select>'
        : '<span class="dim">' + esc(g.name) + ', chromosome ' + esc(g.chr) + '</span>')
      + '</div>';

    if (!mine) {
      return '<div class="allele-props" data-props="' + esc(symbol) + '">' + head
        + (mappable(g) ? '<div class="props-row"><label>Map position</label>'
          + '<span class="props-map">' + FCS.mapEditor.rowHtml(g.id) + '</span></div>' : '')
        + '</div>';
    }

    var lethal = LETHAL.map(function (o) {
      return '<option value="' + o.value + '"' + ((a.lethal || 'none') === o.value ? ' selected' : '') + '>'
        + esc(o.label) + '</option>';
    }).join('');
    var look = FCS.overrides.currentLook(a);
    var looks = FCS.overrides.lookOptions().map(function (o) {
      return '<option value="' + esc(o.value) + '"' + (o.value === look ? ' selected' : '') + '>'
        + esc(o.label) + '</option>';
    }).join('');
    var dom = ['recessive', 'dominant'].map(function (d) {
      return '<option value="' + d + '"' + (a.dominance === d ? ' selected' : '') + '>' + d + '</option>';
    }).join('');
    var cis = FCS.overrides.markerChoices().map(function (id) {
      var m = FCS.data.alleles[id];
      if (!m || FCS.data.genes[m.gene].chr !== g.chr) return '';
      return '<button type="button" class="chip" data-cis="' + esc(symbol) + '|' + esc(m.symbol) + '">'
        + esc(m.symbol) + '</button>';
    }).join('');

    return '<div class="allele-props" data-props="' + esc(symbol) + '">' + head
      + '<div class="props-row"><label>When homozygous</label>'
      + '<select data-lethal="' + esc(symbol) + '">' + lethal + '</select></div>'
      + '<div class="props-row"><label>Looks like</label>'
      + '<select data-plook="' + esc(symbol) + '">' + looks + '</select>'
      + '<select data-pdom="' + esc(symbol) + '">' + dom + '</select></div>'
      + (mappable(g) ? '<div class="props-row"><label>Map position</label>'
        + '<span class="props-map">' + FCS.mapEditor.rowHtml(g.id) + '</span></div>' : '')
      + (cis ? '<div class="props-row"><label>Also on that chromosome</label>'
        + '<span class="props-cis">' + cis + '</span></div>' : '')
      + '<div class="props-row props-end">'
      + '<button type="button" class="link-btn danger" data-forget="' + esc(symbol) + '">delete this allele</button>'
      + '</div>'
      + '</div>';
  }

  /* ---------- the panel ---------- */

  function panelHtml(onBench, genotype) {
    lastGenotype = genotype || lastGenotype;
    var list = (onBench || []).slice();
    if (showAll) {
      Object.keys(FCS.data.alleles).forEach(function (id) {
        if (list.indexOf(id) < 0) list.push(id);
      });
    }
    /* yours first, since they are the ones with something to set */
    list.sort(function (x, y) {
      var ax = FCS.data.alleles[x], ay = FCS.data.alleles[y];
      if (!ax || !ay) return 0;
      if (!!ax.unknown !== !!ay.unknown) return ax.unknown ? -1 : 1;
      return ax.symbol < ay.symbol ? -1 : 1;
    });
    if (!list.length) {
      return '<p class="hint">No alleles on the bench yet. Add a vial, or tick the box to see everything '
        + 'the app knows.</p>';
    }
    var mine = list.filter(function (id) { return FCS.data.alleles[id] && FCS.data.alleles[id].unknown; });
    return (mine.length
      ? '<p class="hint">' + mine.length + ' of these ' + (mine.length === 1 ? 'is' : 'are') + ' yours: the app '
        + 'knows nothing about them until you say. What you set holds wherever that allele appears.</p>'
      : '')
      + list.map(blockHtml).join('');
  }

  /* Put a marker in cis with the allele, in the genotype text: find the side of
     the slash the allele is written on and add it there. */
  function withCis(text, symbol, marker) {
    var segments = String(text || '').split(';');
    var done = false;
    var out = segments.map(function (seg) {
      if (done) return seg;
      var sides = seg.split('/');
      var fixed = sides.map(function (side) {
        if (done) return side;
        var toks = FCS.parse.splitTop(side);
        if (toks.indexOf(symbol) < 0) return side;
        done = true;
        return side.replace(/\s*$/, '') + ',' + marker;
      });
      return fixed.join('/');
    }).join(';');
    return done ? out : text;
  }

  function init(cb) {
    esc = FCS.inspector.esc;
    onChange = cb;

    root.document.addEventListener('change', function (ev) {
      var t = ev.target;
      if (!t.hasAttribute) return;

      if (t.id === 'alleleShowAll') {
        showAll = t.checked;
        if (onChange) onChange({});
        return;
      }
      if (t.hasAttribute('data-chr')) {
        var sym = t.getAttribute('data-chr');
        var gene = geneOf(sym);
        if (!gene) return;
        var from = gene.chr;
        if (from === t.value) return;
        if (!FCS.data.moveGene(gene.id, t.value)) { t.value = from; return; }
        FCS.overrides.save();
        if (onChange) onChange({ moved: { geneId: gene.id, symbol: sym, from: from, to: t.value } });
        return;
      }
      if (t.hasAttribute('data-lethal')) {
        FCS.data.setAlleleProps(t.getAttribute('data-lethal'), { lethal: t.value });
        FCS.overrides.save();
        if (onChange) onChange({});
        return;
      }
      if (t.hasAttribute('data-plook') || t.hasAttribute('data-pdom')) {
        var s2 = t.getAttribute('data-plook') || t.getAttribute('data-pdom');
        var box = root.document.querySelector('[data-props="' + s2.replace(/(["\\])/g, '\\$1') + '"]');
        if (!box) return;
        var lk = box.querySelector('[data-plook]');
        var dm = box.querySelector('[data-pdom]');
        FCS.overrides.setLook(s2, lk ? lk.value : '', dm ? dm.value : 'recessive');
        if (onChange) onChange({});
      }
    });

    root.document.addEventListener('click', function (ev) {
      var c = ev.target.closest('[data-cis]');
      if (c) {
        var bits = c.getAttribute('data-cis').split('|');
        var box = root.document.getElementById('stockGenotype');
        if (!box) return;
        box.value = withCis(box.value.trim() || lastGenotype, bits[0], bits[1]);
        box.focus();
        return;
      }
      var f = ev.target.closest('[data-forget]');
      if (!f) return;
      var sym = f.getAttribute('data-forget');
      if (!root.confirm('Delete ' + sym + '? It goes from the library and from any fly carrying it.')) return;
      var gene = geneOf(sym);
      if (FCS.data.forgetAllele(sym)) {
        FCS.overrides.save();
        if (onChange) onChange({ forgotten: { symbol: sym, geneId: gene ? gene.id : null } });
      }
    });
  }

  FCS.alleleProps = { init: init, panelHtml: panelHtml, withCis: withCis };
})(typeof globalThis !== 'undefined' ? globalThis : this);
