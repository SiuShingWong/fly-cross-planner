/* Fly Cross Planner - the plan as a picture.
 *
 * A list reads in order but hides the shape: which crosses wait on which, what
 * runs side by side, where the long arm is. This draws the plan as a graph, one
 * row per generation, time running down the page, with an arrow from a cross to
 * anything that uses its flies, labelled with the class you keep and how often
 * it comes up.
 *
 * Drawn as plain SVG, laid out here rather than by a library, so it works off
 * the disk with nothing else loaded and prints as it looks. Text is measured
 * rather than guessed at, because a genotype is as long as it is and nothing
 * should run past the edge of its box.
 *
 * Exports FCS.graph — svg, layout, fit
 * Needs the steps it is given (FCS.scheme.plan output), and FCS.parse only to
 *   decide which half of a genotype is a gene of the user's own.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};

  var W = 196, H = 82, GAP_X = 26, GAP_Y = 58, PAD = 18;
  var F_TITLE = '600 12px -apple-system, sans-serif';
  var F_DATE = '10px -apple-system, sans-serif';
  var F_GENO = '11px ui-monospace, Menlo, monospace';
  var F_KEPT = '10px -apple-system, sans-serif';
  var F_EDGE = '10px -apple-system, sans-serif';

  var ctx = null;
  function widthOf(text, font) {
    if (ctx === null) {
      ctx = false;
      if (root.document && root.document.createElement) {
        var c = root.document.createElement('canvas');
        if (c.getContext) ctx = c.getContext('2d');
      }
    }
    if (!ctx) return String(text).length * (font === F_GENO ? 6.7 : 5.6);   /* node, no browser */
    ctx.font = font;
    return ctx.measureText(String(text)).width;
  }

  /* A genotype drawn in tspans so the gene you are following stands out from
     the balancers and standard markers holding it. Called on text that has
     already been through fit(), so the width is settled and the tspans only
     colour what is there. */
  function genoSpans(text) {
    return String(text || '').split(';').map(function (seg) {
      return seg.split('/').map(function (side) {
        /* fit() may have cut a name short, and half a name is in no library,
           so the ellipsis comes off before the name is judged. */
        var probe = side.replace(/[\u2026.]+$/, '');
        var own = FCS.parse && FCS.parse.isYourSide && FCS.parse.isYourSide(probe);
        return '<tspan class="' + (own ? 'g-own' : 'g-std') + '">' + esc(side) + '</tspan>';
      }).join('<tspan class="g-std">/</tspan>');
    }).join('<tspan class="g-std">;</tspan>');
  }

  /* Cut to what fits, with an ellipsis, so nothing leaves its box. */
  function fit(text, font, room) {
    text = String(text === undefined || text === null ? '' : text);
    if (!text || widthOf(text, font) <= room) return text;
    var lo = 0, hi = text.length;
    while (lo < hi) {
      var mid = Math.ceil((lo + hi) / 2);
      if (widthOf(text.slice(0, mid) + '…', font) <= room) lo = mid; else hi = mid - 1;
    }
    return lo > 0 ? text.slice(0, lo) + '…' : '';
  }

  function esc(t) {
    return String(t === undefined || t === null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* One row per generation, time down the page. */
  function layout(steps) {
    var byGen = {}, order = [];
    steps.forEach(function (s) {
      var g = s.generation || 1;
      if (!byGen[g]) { byGen[g] = []; order.push(g); }
      byGen[g].push(s);
    });
    order.sort(function (a, b) { return a - b; });

    var nodes = {}, widest = 0;
    order.forEach(function (g, row) {
      byGen[g].forEach(function (s, col) {
        nodes[s.id] = {
          step: s,
          x: PAD + col * (W + GAP_X),
          y: PAD + row * (H + GAP_Y)
        };
      });
      widest = Math.max(widest, byGen[g].length);
    });
    return {
      nodes: nodes,
      rows: order,
      width: PAD * 2 + widest * W + Math.max(0, widest - 1) * GAP_X,
      height: PAD * 2 + order.length * H + Math.max(0, order.length - 1) * GAP_Y,
      generations: order.length
    };
  }

  /* One arrow per pair of crosses, however many flies travel along it. */
  /* One arrow per pair of crosses, however many flies travel along it. The
     label sits just above the cross it feeds rather than at the middle of the
     curve, which on a long diagonal used to land on top of another box. */
  function edge(from, to, labels, i) {
    var x1 = from.x + W / 2, y1 = from.y + H;
    var x2 = to.x + W / 2, y2 = to.y;
    var mid = (y1 + y2) / 2;
    var d = 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + mid + ' ' + x2 + ',' + mid + ' ' + x2 + ',' + y2;
    var text = labels.join(' \u00b7 ');
    return '<path class="g-edge" d="' + d + '" marker-end="url(#g-arrow)"/>'
      + (text
        ? '<text class="g-edge-label" x="' + x2 + '" y="' + (y2 - 10 - (i || 0) * 13) + '" text-anchor="middle">'
          + esc(fit(text, F_EDGE, W + GAP_X)) + '</text>'
        : '');
  }

  function node(n, activeIds, activeId) {
    var s = n.step;
    var on = activeIds.indexOf(s.id) >= 0;
    var here = s.id === activeId;
    var pad = 10, inner = W - pad * 2;

    var date = fit(s.dateText, F_DATE, inner * 0.52);
    var dateW = date ? widthOf(date, F_DATE) : 0;
    var title = fit(s.name, F_TITLE, inner - dateW - (date ? 8 : 0));

    var kept = s.kept.map(function (k) {
      return (k.sex === 'F' ? '♀' : '♂') + ' ' + k.label
        + (k.p ? ' ' + (k.p * 100).toFixed(0) + '%' : '');
    }).join('   ');

    return '<g class="g-node' + (on ? ' g-on' : '') + (here ? ' g-here' : '') + '"'
      + ' data-node="' + esc(s.id) + '" transform="translate(' + n.x + ',' + n.y + ')">'
      + '<rect width="' + W + '" height="' + H + '" rx="7"/>'
      + '<text class="g-title" x="' + pad + '" y="18">' + esc(title) + '</text>'
      + (date ? '<text class="g-date" x="' + (W - pad) + '" y="18" text-anchor="end">' + esc(date) + '</text>' : '')
      + '<text class="g-geno" x="' + pad + '" y="36">♀ '
      + genoSpans(fit(s.mother.genotype, F_GENO, inner - 12)) + '</text>'
      + '<text class="g-geno" x="' + pad + '" y="52">♂ '
      + genoSpans(fit(s.father.genotype, F_GENO, inner - 12)) + '</text>'
      + (kept ? '<text class="g-kept" x="' + pad + '" y="70">' + esc(fit(kept, F_KEPT, inner)) + '</text>' : '')
      + '</g>';
  }

  /* steps: what FCS.scheme.plan returns. activeIds: the crosses behind the vial
     you are looking at; activeId: that vial itself. */
  function svg(steps, activeIds, activeId) {
    if (!steps || !steps.length) return '';
    activeIds = activeIds || [];
    var L = layout(steps);
    var parts = [], links = {}, order = [];

    steps.forEach(function (s) {
      ['mother', 'father'].forEach(function (side) {
        var from = s[side].from;
        if (!from || !from.step) return;
        var parent = steps[from.step - 1];
        if (!parent || !L.nodes[parent.id]) return;
        var key = parent.id + '>' + s.id;
        if (!links[key]) { links[key] = { from: parent.id, to: s.id, labels: [] }; order.push(key); }
        var text = (from.sex === 'F' ? '♀ ' : '♂ ') + from.label
          + (from.p ? ' ' + (from.p * 100).toFixed(0) + '%' : '');
        if (links[key].labels.indexOf(text) < 0) links[key].labels.push(text);
      });
    });

    var incoming = {};
    order.forEach(function (key) {
      var l = links[key];
      var labels = l.labels;
      if (labels.length === 2) {
        var a = labels[0].slice(2), b = labels[1].slice(2);
        if (a === b) labels = ['♀♂ ' + a];
      }
      incoming[l.to] = incoming[l.to] || 0;
      parts.push(edge(L.nodes[l.from], L.nodes[l.to], labels, incoming[l.to]++));
    });
    steps.forEach(function (s) { parts.push(node(L.nodes[s.id], activeIds, activeId)); });

    return '<svg class="plan-graph" viewBox="0 0 ' + L.width + ' ' + L.height + '"'
      + ' width="' + L.width + '" height="' + L.height + '" role="img" aria-label="the crossing plan">'
      + '<defs><marker id="g-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7"'
      + ' orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z"/></marker></defs>'
      + parts.join('') + '</svg>';
  }

  FCS.graph = { svg: svg, layout: layout, fit: fit };
})(typeof globalThis !== 'undefined' ? globalThis : this);
