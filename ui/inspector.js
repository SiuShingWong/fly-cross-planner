/* Fly Cross Planner - click a fly and see why it looks like that.  *
 * Exports FCS.inspector — render, esc, sexMark
 * Needs FCS.data, FCS.genetics, FCS.phenotype, FCS.flyart, FCS.overrides and
 *   FCS.mapEditor (for the chromosome bar).
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* A genotype with the balancers held back: what you are following is in
     ordinary text, the chromosome holding it steady is greyed. The engine gives
     the pieces; this only decides how they look. */
  function genotypeHtml(fly) {
    return FCS.genetics.genotypeParts(fly).map(function (part) {
      return part.sides.map(function (side) {
        return '<span class="' + (side.yours ? 'geno-own' : 'geno-std') + '">'
          + esc(side.text) + '</span>';
      }).join('<span class="geno-slash">/</span>');
    }).join('<span class="geno-sep">; </span>');
  }

  function sexMark(sex) { return sex === 'M' ? '♂' : '♀'; }

  function traitRows(ph) {
    var rows = '', k;
    for (k in ph.traits) {
      if (!Object.prototype.hasOwnProperty.call(ph.traits, k)) continue;
      var t = FCS.data.traits[k];
      var val = ph.traits[k];
      if (val === t.wild && !FCS.data.isDrawn(k, val)) continue;
      if (!FCS.data.isDrawn(k, val) && val !== FCS.data.traits[k].wild) {
        rows += '<tr class="mutant"><td class="thumb"></td><td>' + esc(t.label) + '</td><td>' + esc(val) + '</td></tr>';
        continue;
      }
      var img = FCS.flyart.icon(k, val);
      var mutant = val !== t.wild;
      rows += '<tr class="' + (mutant ? 'mutant' : '') + '">'
        + '<td class="thumb"><img src="' + img + '" alt="' + esc(val) + '"></td>'
        + '<td>' + esc(t.label) + '</td>'
        + '<td>' + esc(val === t.wild ? 'wild type' : val) + '</td>'
        + '</tr>';
    }
    return rows;
  }

  function noArt(a) {
    var eff = a.effect || {}, k;
    for (k in eff) {
      if (Object.prototype.hasOwnProperty.call(eff, k) && !FCS.data.isDrawn(k, eff[k])) return true;
    }
    return false;
  }

  /* Your own alleles are invisible by default. If one of them does show, say so
     here once and it holds everywhere that allele appears. */
  function lookEditor(a) {
    var current = FCS.overrides.currentLook(a);
    var opts = FCS.overrides.lookOptions().map(function (o) {
      return '<option value="' + esc(o.value) + '"' + (o.value === current ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    }).join('');
    var dom = ['recessive', 'dominant'].map(function (d) {
      return '<option value="' + d + '"' + (a.dominance === d ? ' selected' : '') + '>' + d + '</option>';
    }).join('');
    return '<div class="look-edit">'
      + '<label>Looks like</label>'
      + '<select data-look="' + esc(a.symbol) + '">' + opts + '</select>'
      + '<select data-dom="' + esc(a.symbol) + '">' + dom + '</select>'
      + '</div>';
  }

  /* Where this allele sits. On a balancer that is the whole answer: the
     inversions stop any crossover product being recovered, so the marker cannot
     come off it and a map position would be misleading. */
  function placeOf(entry, g) {
    if (entry.onBalancer) {
      var b = FCS.data.balancers[entry.onBalancer];
      if (b && b.suppresses !== false) {
        return 'carried on ' + esc(entry.onBalancer) + ' &mdash; cannot be separated from it by recombination';
      }
      return 'carried on ' + esc(entry.onBalancer) + ' &mdash; which does not suppress recombination, so it can come off';
    }
    if (g.onBalancerOnly) {
      return 'chromosome ' + esc(g.chr) + ' &mdash; a marker only ever carried on a balancer, so it does not '
        + 'recombine away (the mutation itself maps to ' + esc(g.chr) + '-' + esc(g.pos) + ')';
    }
    return 'chromosome ' + esc(g.chr)
      + (typeof g.pos === 'number' ? ' at ' + esc(g.pos) + ' cM' : ', map position not known');
  }

  function alleleBlock(entry, hidden) {
    var a = entry.allele, g = entry.gene;
    var bar = (!entry.onBalancer && FCS.mapEditor && typeof g.pos === 'number' && !g.onBalancerOnly)
      ? FCS.mapEditor.barHtml(g.id) : '';
    return '<div class="allele' + (hidden ? ' hidden-allele' : '') + '">'
      + '<div class="allele-head"><span class="sym">' + esc(a.symbol) + '</span> '
      + '<span class="name">' + esc(a.name) + '</span>'
      + '<span class="tag">' + esc(a.dominance) + '</span>'
      + '<span class="tag">' + esc(entry.zygosity) + '</span></div>'
      + '<div class="allele-meta">' + placeOf(entry, g)
      + (a.lethal !== 'none' ? ' &middot; ' + esc(a.lethal) + ' lethal' : '') + '</div>'
      + (a.stage ? '<div class="allele-meta">scored on the ' + esc(a.stage) + ', not on adults</div>' : '')
      + (g.note ? '<div class="allele-note">' + esc(g.note) + '</div>' : '')
      + (noArt(a) ? '<div class="allele-note dim">No drawing for this one yet, so it is labelled on the fly instead.</div>' : '')
      + (a.unknown ? lookEditor(a) : '')
      + bar
      + '</div>';
  }

  function render(el, item) {
    if (!item) {
      el.innerHTML = '<p class="empty">Click a fly to look at it.</p>';
      return;
    }
    var f = item.fly, ph = item.phenotype;
    var html = '<div class="insp-head">'
      + '<div class="insp-sex">' + sexMark(ph.sex) + '</div>'
      + '<div><div class="insp-pheno">' + esc(ph.label) + '</div>'
      + '<div class="insp-geno">' + genotypeHtml(f) + '</div></div></div>'
      + '<div class="insp-portrait" id="insp-portrait"></div>'
      + '<table class="traits">' + traitRows(ph) + '</table>';

    if (ph.expressed.length) {
      html += '<h4>What you are seeing</h4>' + ph.expressed.map(function (e) { return alleleBlock(e, false); }).join('');
    }
    if (ph.carried.length) {
      html += '<h4>Carried but not showing</h4>' + ph.carried.map(function (e) { return alleleBlock(e, true); }).join('');
    }
    var bals = [];
    FCS.genetics.CHRS.forEach(function (chrId) {
      f.chrs[chrId].forEach(function (h) {
        if (h.balancer) bals.push(FCS.data.balancers[h.balancer]);
      });
    });
    if (bals.length) {
      html += '<h4>Balancers</h4>' + bals.map(function (b) {
        return '<div class="allele"><div class="allele-head"><span class="sym">' + esc(b.id) + '</span>'
          + '<span class="tag">chromosome ' + esc(b.chr) + '</span>'
          + '<span class="tag">' + esc(b.lethal) + ' lethal</span></div>'
          + '<div class="allele-note">' + esc(b.note) + '</div></div>';
      }).join('');
    }
    el.innerHTML = html;
    var slot = el.querySelector('#insp-portrait');
    if (slot) slot.appendChild(FCS.flyart.element({ sex: ph.sex, traits: ph.traits }, 150));
  }

  FCS.inspector = { render: render, esc: esc, sexMark: sexMark, genotypeHtml: genotypeHtml };
})(typeof globalThis !== 'undefined' ? globalThis : this);
