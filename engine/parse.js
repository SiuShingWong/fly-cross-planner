/* Fly Cross Planner - genotype text in and out.
 *
 * Accepts the notation people actually write:
 *   w                     -> w/w  (or w/Y in a male)
 *   w; vg/CyO             -> X homozygous w, chromosome 2 vg over CyO
 *   y,w; dp,vg/CyO; se/+  -> two markers in cis on the X
 * Semicolons separate chromosomes in the order X ; 2 ; 3 ; 4.
 * Anything it cannot read is returned in `unknown` rather than guessed at.
 *
 * Exports FCS.parse — parse, format, lookupAllele, lookupBalancer, lookupCompound,
 *   lookupMarkedY, isYourSide, splitTop, rebuildIndex
 * Needs FCS.data and FCS.genetics. Note that parse() registers an allele it has
 *   never seen, so do not call it on half-typed text.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};
  var ORDER = ['X', '2', '3', '4'];
  /* Forms people write as one word. */
  var RUN_TOGETHER = { 'yw': ['y[1]', 'w[1118]'], 'wy': ['y[1]', 'w[1118]'], 'ywf': ['y[1]', 'w[1118]', 'f[1]'] };

  function norm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }

  var exactIndex = null, looseIndex = null, balancerIndex = null, compoundIndex = null;
  var indexedCount = -1;

  function tidy(s) { return String(s || '').replace(/\s+/g, ''); }

  /* Case matters in fly notation: b is black, B is Bar. Exact match wins, and a
   * case-insensitive match is only accepted when it is unambiguous. */
  function buildIndex() {
    exactIndex = {}; looseIndex = {};
    indexedCount = FCS.data.alleleVersion;
    function addExact(k, id) { if (k && exactIndex[k] === undefined) exactIndex[k] = id; }
    function addLoose(k, id) {
      if (!k) return;
      k = k.toLowerCase();
      if (looseIndex[k] === undefined) looseIndex[k] = id;
      else if (looseIndex[k] !== id) looseIndex[k] = '__ambiguous__';
    }
    Object.keys(FCS.data.alleles).forEach(function (id) {
      var a = FCS.data.alleles[id];
      var forms = [id, a.symbol, id.replace(/[\[\]]/g, ''), a.symbol + '1', a.symbol + '-'];
      forms.forEach(function (fm) { addExact(tidy(fm), id); });
      forms.forEach(function (fm) { addLoose(tidy(fm), id); });
    });
    balancerIndex = {};
    Object.keys(FCS.data.balancers).forEach(function (id) {
      var b = FCS.data.balancers[id];
      balancerIndex[tidy(id).toLowerCase()] = id;
      (b.aliases || []).forEach(function (al) { balancerIndex[tidy(al).toLowerCase()] = id; });
    });
    compoundIndex = {};
    Object.keys(FCS.data.compounds || {}).forEach(function (id) {
      var cp = FCS.data.compounds[id];
      compoundIndex[tidy(id).toLowerCase()] = id;
      (cp.aliases || []).forEach(function (al) { compoundIndex[tidy(al).toLowerCase()] = id; });
    });
  }

  function lookupBalancer(text) {
    if (!balancerIndex) buildIndex();
    return balancerIndex[tidy(text).toLowerCase()] || null;
  }

  function lookupCompound(text) {
    if (!compoundIndex) buildIndex();
    return compoundIndex[tidy(text).toLowerCase()] || null;
  }

  function lookupAllele(text) {
    /* Alleles are registered as stocks are read, so the index has to be rebuilt
       whenever the library has grown since it was last built. */
    if (!exactIndex || indexedCount !== FCS.data.alleleVersion) buildIndex();
    var t = tidy(text);
    if (exactIndex[t] !== undefined) return exactIndex[t];
    var loose = looseIndex[t.toLowerCase()];
    return (loose && loose !== '__ambiguous__') ? loose : null;
  }

  /* A Y carrying a marker: written as its own name, never as a list of alleles,
     because nothing else travels on a Y. */
  function lookupMarkedY(text) {
    var t = tidy(text).toLowerCase();
    var out = null;
    Object.keys(FCS.data.markedY || {}).forEach(function (id) {
      var y = FCS.data.markedY[id];
      var names = [id].concat(y.aliases || []);
      names.forEach(function (n) { if (tidy(n).toLowerCase() === t) out = y; });
    });
    return out;
  }

  /* Split on commas that are not inside brackets, so Df(2L)ED1, b stays in
   * one piece and w[1118] is not cut in half. */
  function splitTop(text) {
    var out = [], depth = 0, cur = '';
    String(text || '').split('').forEach(function (ch) {
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      if (ch === ',' && depth <= 0) { out.push(cur); cur = ''; }
      else cur += ch;
    });
    out.push(cur);
    return out.map(function (t) { return t.trim(); }).filter(function (t) { return t.length; });
  }

  /* Balancer names carry commas of their own (TM3,Sb), so match the longest
   * run of leading tokens that names one. */
  function takeBalancer(tokens) {
    for (var n = Math.min(4, tokens.length); n >= 1; n--) {
      var joined = tokens.slice(0, n).join(',');
      var bal = lookupBalancer(joined);
      if (bal) return { id: bal, rest: tokens.slice(n) };
      var comp = lookupCompound(joined);
      if (comp) return { compound: comp, rest: tokens.slice(n) };
    }
    /* People also write these with a space: "Spd2 SM6^TM6". Look inside each
       token for a name we know, so an attached pair is not missed. */
    for (var i = 0; i < tokens.length; i++) {
      var words = tokens[i].split(/\s+/);
      if (words.length < 2) continue;
      for (var w = 0; w < words.length; w++) {
        var c = lookupCompound(words[w]);
        if (c) {
          var rest = tokens.slice();
          rest[i] = words.filter(function (x, j) { return j !== w; }).join(' ');
          return { compound: c, rest: rest.filter(function (x) { return x.trim().length; }) };
        }
      }
    }
    return null;
  }

  /* One side of a slash, read without deciding which chromosome it is on. */
  function readSide(text, report) {
    var t = String(text || '').trim();
    if (!t || t === '+' || t === '++') return { kind: 'wild', alleles: {}, pending: [], chrs: [] };
    /* A side that is nothing but a y is the Y chromosome, in either case. The
       yellow allele is also written y, but never on its own as a whole side. */
    if (/^y$/i.test(t)) return { kind: 'Y', alleles: {}, pending: [], chrs: [] };
    var marked = lookupMarkedY(t);
    if (marked) {
      return { kind: 'Y', yName: marked.id, alleles: marked.markers.slice(), pending: [], chrs: [] };
    }

    var tokens = splitTop(t);
    var side = { kind: 'alleles', alleles: {}, pending: [], chrs: [], balancer: null, compound: null };

    var bal = takeBalancer(tokens);
    if (bal) {
      tokens = bal.rest;
      if (bal.compound) {
        side.compound = bal.compound;
        report.compounds.push(bal.compound);
      } else {
        side.balancer = bal.id;
        side.chrs.push(FCS.data.balancers[bal.id].chr);
      }
    }

    tokens.forEach(function (tok) {
      if (!tok || tok === '+') return;
      if (/^#\d+$/.test(tok)) { report.labels.push(tok); return; }     /* line numbers */
      var run = RUN_TOGETHER[tok.toLowerCase()];
      if (run) {
        run.forEach(function (aid) {
          var gene = FCS.data.alleles[aid].gene;
          side.alleles[gene] = aid;
          var c = FCS.data.genes[gene].chr;
          if (side.chrs.indexOf(c) < 0) side.chrs.push(c);
        });
        return;
      }
      var aid = lookupAllele(tok);
      if (aid) {
        var gene = FCS.data.alleles[aid].gene;
        side.alleles[gene] = aid;
        var chr = FCS.data.genes[gene].chr;
        if (side.chrs.indexOf(chr) < 0) side.chrs.push(chr);
      } else {
        side.pending.push(tok);
      }
    });
    if (side.balancer && !tokens.length && !Object.keys(side.alleles).length && !side.pending.length) {
      side.kind = 'balancer';
    }
    return side;
  }

  /* Split on slashes, but keep a balancer name containing one in a single piece. */
  function splitSides(seg) {
    var parts = seg.split('/');
    if (parts.length <= 2) return parts;
    return [parts[0], parts.slice(1).join('/')];
  }

  function sideHap(side, chrId, report) {
    var G = FCS.genetics;
    if (!side || side.kind === 'wild') return G.wildHap(chrId);
    if (side.kind === 'Y') {
      var ys = {};
      (side.alleles && side.alleles.length ? side.alleles : []).forEach(function (aid) {
        var al = FCS.data.alleles[aid];
        if (al) ys[al.gene] = aid;
      });
      return G.yHap(ys, side.yName);
    }

    var h;
    if (side.balancer) h = G.balancerHap(side.balancer);
    else h = G.hap(chrId, {}, null);

    Object.keys(side.alleles).forEach(function (gene) { h.alleles[gene] = side.alleles[gene]; });
    side.pending.forEach(function (tok) {
      var aid = FCS.data.ensureAllele(tok, chrId);
      h.alleles[FCS.data.alleles[aid].gene] = aid;
      if (report.unknown.indexOf(tok) < 0) report.unknown.push(tok);
    });
    return h;
  }

  /* Which of the things written in this segment belongs where, and what to do
     if one of them is filed on the wrong chromosome. The usual cause: the gene
     was first written somewhere the app had nothing to go on, so it went by
     position in the text. */
  function whoIsWhere(a, b) {
    var seen = {}, bits = [], mine = [];
    [a, b].forEach(function (side) {
      if (!side) return;
      if (side.balancer) {
        var bc = FCS.data.balancers[side.balancer].chr;
        if (!seen[side.balancer]) { seen[side.balancer] = 1; bits.push(side.balancer + ' is on ' + bc); }
      }
      Object.keys(side.alleles).forEach(function (geneId) {
        var g = FCS.data.genes[geneId];
        var sym = FCS.data.alleles[side.alleles[geneId]].symbol;
        if (seen[sym]) return;
        seen[sym] = 1;
        bits.push(sym + ' is on ' + g.chr);
        if (g.unknown) mine.push(sym);
      });
    });
    var out = bits.join(', ') + '.';
    if (mine.length) {
      out += ' ' + mine.join(' and ') + (mine.length > 1 ? ' are' : ' is')
        + ' yours, filed on that chromosome when first written. Move '
        + (mine.length > 1 ? 'them' : 'it') + ' under "What these alleles do", '
        + 'or write the chromosome it belongs on.';
    }
    return out;
  }

  /* An allele is placed on its own gene's chromosome, whatever position it was
   * written in. A balancer in the same segment settles the chromosome for
   * anything written beside it, so cnn[f]/TM6B puts cnn on 3. Position is the
   * fallback for segments that name nothing the library knows. */
  function parse(text, sex) {
    var G = FCS.genetics;
    sex = sex === 'M' ? 'M' : 'F';
    var report = { unknown: [], compounds: [], labels: [], errors: [] };
    var segs = String(text || '').split(';').map(function (x) { return x.trim(); });
    if (segs.length && segs[segs.length - 1] === '') segs.pop();

    var parsedSegs = segs.map(function (seg, i) {
      var sides = splitSides(seg);
      var a = readSide(sides[0], report);
      var b = sides.length > 1 ? readSide(sides[1], report) : null;
      var chrs = a.chrs.slice();
      if (b) b.chrs.forEach(function (c) { if (chrs.indexOf(c) < 0) chrs.push(c); });
      if (chrs.length > 1) {
        report.errors.push('"' + seg + '" mixes chromosomes ' + chrs.join(' and ') + '. ' + whoIsWhere(a, b));
        report.mixed = true;
      }
      return { raw: seg, slot: i, a: a, b: b, chr: chrs.length === 1 ? chrs[0] : null };
    });

    var taken = {};
    parsedSegs.forEach(function (ps) {
      if (!ps.chr) return;
      if (taken[ps.chr]) report.errors.push('chromosome ' + ps.chr + ' given twice');
      taken[ps.chr] = ps;
    });
    parsedSegs.forEach(function (ps) {
      if (ps.chr) return;
      var want = ORDER[ps.slot];
      if (want && !taken[want]) { ps.chr = want; taken[want] = ps; return; }
      for (var i = 0; i < ORDER.length; i++) {
        if (!taken[ORDER[i]]) { ps.chr = ORDER[i]; taken[ORDER[i]] = ps; return; }
      }
    });

    var chrs = {};
    parsedSegs.forEach(function (ps) {
      if (!ps.chr) return;
      var h0 = sideHap(ps.a, ps.chr, report);
      var h1;
      if (ps.b) h1 = sideHap(ps.b, ps.chr, report);
      else if (ps.chr === 'X' && sex === 'M') h1 = G.yHap();
      else h1 = sideHap(ps.a, ps.chr, report);
      chrs[ps.chr] = [h0, h1];
    });

    if (sex === 'M') {
      if (!chrs.X) chrs.X = [G.wildHap('X'), G.yHap()];
      else if (chrs.X[1].chr !== 'Y') chrs.X = [chrs.X[0], G.yHap()];
    }

    var specified = parsedSegs.filter(function (ps) {
      return ps.chr && ps.raw && ps.raw !== '+' && ps.raw !== '+/+';
    }).map(function (ps) { return ps.chr; });

    return {
      fly: G.fly(sex, chrs),
      specified: specified,
      unknown: report.errors,          /* kept for callers that check .unknown */
      newMarkers: report.unknown,
      compounds: report.compounds,
      labels: report.labels,
      modelled: report.compounds.length === 0,
      ok: report.errors.length === 0
    };
  }

  function format(f) { return FCS.genetics.genotypeString(f); }

  /* One side of a slash, as written: is this a gene the user told the app
     about, or something that ships with it? Display only — it decides whether
     a name is picked out or left quiet, and the answer for "+", a Y, a
     balancer and the classical markers is always no. Genotypes drawn from a
     live fly go through FCS.genetics.genotypeParts instead, which knows the
     alleles rather than guessing from their names. */
  function isYourSide(text) {
    var t = String(text || '').trim();
    if (!t || t === '+' || /^Y$/i.test(t)) return false;
    if (lookupBalancer(t.split(',')[0])) return false;
    if (lookupMarkedY(t)) return false;
    return t.split(',').some(function (sym) {
      var s = sym.trim();
      if (!s || s === '+') return false;
      var id = lookupAllele(s);
      /* A symbol the library has never heard of was written by the user, so it
         counts as theirs even before ensureAllele has filed it. */
      return !id || FCS.data.isYours(id);
    });
  }

  FCS.parse = {
    parse: parse,
    format: format,
    lookupAllele: lookupAllele,
    lookupBalancer: lookupBalancer,
    lookupCompound: lookupCompound,
    lookupMarkedY: lookupMarkedY,
    isYourSide: isYourSide,
    splitTop: splitTop,
    rebuildIndex: function () { exactIndex = null; looseIndex = null; balancerIndex = null; compoundIndex = null; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
