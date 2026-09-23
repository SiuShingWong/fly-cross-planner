/* Fly Cross Planner - map positions.
 *
 * Recombination needs a distance, and a distance needs a position for each
 * gene. FlyBase gives one per gene, written like 2-67.0: the chromosome, then
 * centimorgans. The library already knows the chromosome, so only the number is
 * asked for here. One number per gene serves every pair, and it fixes gene
 * order along the chromosome, which a bare pair distance cannot.
 *
 * A gene with no position stays without one. That is the honest state for a
 * line you made yourself and never mapped: the engine then refuses to invent
 * recombinants involving it and says so, rather than quietly reporting a
 * frequency nobody measured. If you have a rough idea, enter it and tick
 * "estimate", and every cross that uses it says it is an estimate.
 *
 * Exports FCS.mapEditor — init, promptHtml, panelHtml, rowHtml, barHtml
 * Needs FCS.data, FCS.overrides and FCS.inspector (for esc).
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};
  var esc, onSaved = null, openBars = {};

  /* A gene worth asking about: on a chromosome that recombines at all, and not
     one of the markers that only ever rides on a balancer - those have nothing
     to be a distance from. */
  function isMappable(geneId) {
    var g = FCS.data.genes[geneId];
    if (!g || g.onBalancerOnly) return false;
    var chr = FCS.data.chromosomes[g.chr];
    return !!(chr && chr.recombines);
  }

  function balancerBorneIn(geneIds) {
    return (geneIds || []).filter(function (id) {
      var g = FCS.data.genes[id];
      return !!(g && g.onBalancerOnly);
    }).map(function (id) { return FCS.data.genes[id].symbol; });
  }


  /* ---------- where a gene sits on its chromosome ---------- */

  /* A map is easier to read than a number. The bar is the genetic map of that
     chromosome in centimorgans, with the centromere marked - which is what says
     whether a gene is on the left arm or the right - and every other mapped gene
     on it as a faint tick, so you can see at a glance what your gene is near and
     how far any two of them are apart. */
  var W = 260, LEFT = 10, RIGHT = 250, MID = 26;

  function atCM(chr, pos) {
    var len = chr.lengthCM || 1;
    return LEFT + Math.max(0, Math.min(1, pos / len)) * (RIGHT - LEFT);
  }

  function armOf(chr, pos) {
    if (!chr.arms || chr.arms.length < 2) return chr.arms ? chr.arms[0] : chr.id;
    return pos <= chr.centromereCM ? chr.arms[0] : chr.arms[1];
  }

  function neighbours(geneId, chrId) {
    return Object.keys(FCS.data.genes).filter(function (id) {
      var g = FCS.data.genes[id];
      return id !== geneId && g.chr === chrId && typeof g.pos === 'number' && !g.onBalancerOnly;
    });
  }

  function barHtml(geneId) {
    var g = FCS.data.genes[geneId];
    if (!g) return '';
    var chr = FCS.data.chromosomes[g.chr];
    if (!chr || !chr.lengthCM) return '';
    if (typeof g.pos !== 'number') {
      return '<div class="map-bar-none">' + esc(g.symbol) + ' has no position yet, so it cannot be placed '
        + 'on chromosome ' + esc(g.chr) + '.</div>';
    }

    var x = atCM(chr, g.pos);
    var parts = ['<svg class="map-bar" viewBox="0 0 ' + W + ' 46" preserveAspectRatio="xMidYMid meet" role="img"'
      + ' aria-label="' + esc(g.symbol) + ' at ' + esc(g.chr) + '-' + g.pos + '">'];

    parts.push('<rect x="' + LEFT + '" y="' + (MID - 3) + '" width="' + (RIGHT - LEFT)
      + '" height="6" rx="3" fill="#e7e1d6"/>');

    /* every 20 cM, so the eye has something to measure against */
    for (var t = 0; t <= chr.lengthCM; t += 20) {
      var tx = atCM(chr, t);
      parts.push('<line x1="' + tx + '" y1="' + (MID + 4) + '" x2="' + tx + '" y2="' + (MID + 8)
        + '" stroke="#c9c1b4"/>');
      parts.push('<text x="' + tx + '" y="' + (MID + 17) + '" class="map-bar-tick">' + t + '</text>');
    }

    if (chr.centromereCM) {
      var cx = atCM(chr, chr.centromereCM);
      parts.push('<circle cx="' + cx + '" cy="' + MID + '" r="4.5" fill="#8d8474"/>');
    }

    neighbours(geneId, g.chr).forEach(function (id) {
      var n = FCS.data.genes[id];
      var nx = atCM(chr, n.pos);
      parts.push('<line x1="' + nx + '" y1="' + (MID - 5) + '" x2="' + nx + '" y2="' + (MID + 5)
        + '" stroke="#b9b1a3"><title>' + esc(n.symbol) + ' ' + esc(n.chr) + '-' + n.pos + '</title></line>');
    });

    parts.push('<line x1="' + x + '" y1="' + (MID - 10) + '" x2="' + x + '" y2="' + (MID + 10)
      + '" stroke="#a8412a" stroke-width="2"/>');
    parts.push('<circle cx="' + x + '" cy="' + (MID - 10) + '" r="3" fill="#a8412a"/>');
    parts.push('<text x="' + Math.min(Math.max(x, 20), W - 20) + '" y="' + (MID - 15)
      + '" class="map-bar-label">' + esc(g.symbol) + '</text>');
    parts.push('</svg>');

    return '<div class="map-bar-wrap">' + parts.join('')
      + '<div class="map-bar-note">' + esc(g.symbol) + ' at <strong>' + esc(g.chr) + '-' + g.pos + '</strong>'
      + (g.approx ? ' (estimate)' : '') + ', on ' + esc(armOf(chr, g.pos)) + '.</div></div>';
  }

  function rowHtml(geneId) {
    var g = FCS.data.genes[geneId];
    if (!g) return '';
    var has = typeof g.pos === 'number';
    return '<div class="map-row" data-map-gene="' + esc(geneId) + '">'
      + '<button type="button" class="map-gene" data-map-show="' + esc(geneId) + '" title="show it on the chromosome">'
      + esc(g.symbol) + '</button>'
      + '<span class="map-at">' + esc(g.chr) + '-</span>'
      + '<input class="map-pos" type="number" step="0.1" inputmode="decimal" placeholder="cM"'
      + ' value="' + (has ? g.pos : '') + '" data-pos="' + esc(geneId) + '">'
      + '<label class="map-approx"><input type="checkbox" data-approx="' + esc(geneId) + '"'
      + (g.approx ? ' checked' : '') + '> estimate</label>'
      + '<button type="button" class="link-btn" data-map-save="' + esc(geneId) + '">save</button>'
      + (has ? '<button type="button" class="link-btn" data-map-clear="' + esc(geneId) + '">unset</button>' : '')
      + '</div>'
      + (openBars[geneId] ? barHtml(geneId) : '');
  }

  /* The block the vial and the cross bar show when a distance is missing. */
  function promptHtml(geneIds, lead) {
    var ids = (geneIds || []).filter(isMappable);
    if (!ids.length) return '';
    return '<div class="map-prompt">'
      + (lead ? '<p>' + esc(lead) + '</p>' : '')
      + ids.map(rowHtml).join('')
      + '<p class="hint">FlyBase writes it as <code>2-67.0</code> \u2014 the chromosome, then the position '
      + 'in centimorgans. Enter the number only. '
      + '<a href="https://flybase.org/" target="_blank" rel="noopener">flybase.org</a> \u2192 search the gene '
      + '\u2192 Genomic Location \u2192 genetic map position. No position for a line you made? Leave it empty: '
      + 'the cross then carries both chromosomes through intact and says so.</p>'
      + '</div>';
  }

  function panelHtml(geneIds, limit) {
    var ids = (geneIds || []).filter(isMappable);
    var borne = balancerBorneIn(geneIds);
    var footer = borne.length
      ? '<p class="hint">' + esc(borne.join(', ')) + ' ' + (borne.length > 1 ? 'are' : 'is')
        + ' carried on a balancer, so there is no distance to set: the inversions stop any crossover '
        + 'product being recovered, and the marker cannot come off.</p>'
      : '';
    if (!ids.length) {
      return '<p class="hint">Nothing on the bench carries a gene that needs a position. Tick the box above '
        + 'to read off every position the library knows.</p>' + footer;
    }
    ids.sort(function (a, b) {
      var ga = FCS.data.genes[a], gb = FCS.data.genes[b];
      var ma = typeof ga.pos === 'number', mb = typeof gb.pos === 'number';
      if (ma !== mb) return ma ? 1 : -1;              /* unmapped first: they are the ones holding you up */
      if (ga.chr !== gb.chr) return ga.chr < gb.chr ? -1 : 1;
      return ma ? ga.pos - gb.pos : (ga.symbol < gb.symbol ? -1 : 1);
    });
    var anyBar = ids.some(function (id) { return openBars[id]; });
    var legend = anyBar
      ? '<p class="hint">On the bar: the scale is centimorgans, the grey dot is the centromere, and the faint '
        + 'ticks are the other mapped genes on that chromosome (hover one for its name). The distance between '
        + 'two genes is the difference between their positions.</p>'
      : '';
    var shown = limit ? ids.slice(0, limit) : ids;
    return legend + shown.map(rowHtml).join('')
      + (shown.length < ids.length
        ? '<p class="hint">' + (ids.length - shown.length) + ' more not shown.</p>' : '')
      + footer;
  }

  function save(geneId, scope) {
    var box = scope.querySelector('[data-pos="' + cssEscape(geneId) + '"]');
    var tick = scope.querySelector('[data-approx="' + cssEscape(geneId) + '"]');
    if (!box) return;
    var raw = box.value.trim();
    FCS.data.setGenePosition(geneId, raw === '' ? null : raw, { approx: !!(tick && tick.checked) });
    FCS.overrides.save();
    if (onSaved) onSaved(geneId);
  }

  function cssEscape(s) { return String(s).replace(/(["\\])/g, '\\$1'); }

  /* One listener for every copy of the form, wherever it is drawn. */
  function init(cb) {
    esc = FCS.inspector.esc;
    onSaved = cb;
    root.document.addEventListener('click', function (ev) {
      var s = ev.target.closest('[data-map-save]');
      if (s) { save(s.getAttribute('data-map-save'), s.closest('.map-prompt, .map-panel') || root.document); return; }
      var show = ev.target.closest('[data-map-show]');
      if (show) {
        var id = show.getAttribute('data-map-show');
        if (openBars[id]) delete openBars[id]; else openBars[id] = true;
        if (onSaved) onSaved(id);
        return;
      }
      var c = ev.target.closest('[data-map-clear]');
      if (c) {
        FCS.data.setGenePosition(c.getAttribute('data-map-clear'), null);
        FCS.overrides.save();
        if (onSaved) onSaved(c.getAttribute('data-map-clear'));
      }
    });
    root.document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || !ev.target.classList.contains('map-pos')) return;
      ev.preventDefault();
      save(ev.target.getAttribute('data-pos'), ev.target.closest('.map-prompt, .map-panel') || root.document);
    });
  }

  FCS.mapEditor = { init: init, promptHtml: promptHtml, panelHtml: panelHtml, rowHtml: rowHtml, barHtml: barHtml };
})(typeof globalThis !== 'undefined' ? globalThis : this);
