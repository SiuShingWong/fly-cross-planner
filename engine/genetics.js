/* Fly Cross Planner - genetics engine
 *
 * A fly is four chromosome pairs. Each haplotype is either a normal chromosome
 * carrying a set of alleles, or a named balancer.
 *
 *   haplotype = { chr: '2', balancer: null | 'CyO', alleles: { geneId: alleleId } }
 *   fly       = { sex: 'F'|'M', chrs: { X:[h,h], '2':[h,h], '3':[h,h], '4':[h,h] } }
 *
 * Males carry a Y in the second X slot: { chr:'Y', balancer:null, alleles:{} }.
 *
 * Exports FCS.genetics — CHRS, hap, balancerHap, yHap, wildHap, fly, cloneHap,
 *   recombFraction, enumerateGametes, viability, cross, sample, genotypeString,
 *   hapString, allelePair, linkage, unmappedWarnings
 * Needs FCS.data.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};
  var AUTOSOMES = ['2', '3', '4'];
  var CHRS = ['X', '2', '3', '4'];

  /* ---------- random ---------- */

  function rngFrom(seed) {
    if (seed === undefined || seed === null) return Math.random;
    var s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- building flies ---------- */

  function hap(chr, alleles, balancer) {
    return { chr: chr, balancer: balancer || null, alleles: alleles || {} };
  }

  function balancerHap(balancerId) {
    var b = FCS.data.balancers[balancerId];
    if (!b) throw new Error('unknown balancer: ' + balancerId);
    var al = {};
    b.markers.forEach(function (aid) {
      var allele = FCS.data.alleles[aid];
      if (allele) al[allele.gene] = aid;
    });
    return hap(b.chr, al, balancerId);
  }

  /* A Y is usually empty, but a marked one (B[S]Y) carries a dominant marker so
     the sexes can be told apart on sight. It is still a Y: no X genes, no
     recombination, and it decides nothing about sex by itself. */
  function yHap(alleles, name) {
    var h = hap('Y', alleles || {}, null);
    if (name) h.yName = name;
    return h;
  }

  /* How many doses of the X a haplotype carries: none for a Y, two for an
     attached pair, one for anything else. Sex follows from the total, as it
     does in the fly: two X doses make a female whatever the Y is doing. */
  function attached(h) {
    if (!h || !h.balancer) return false;
    var b = FCS.data.balancers[h.balancer];
    return !!(b && b.attached);
  }

  function xDose(h) {
    if (!h || h.chr === 'Y') return 0;
    return attached(h) ? 2 : 1;
  }

  function sexOf(xPair) {
    return (xDose(xPair[0]) + xDose(xPair[1])) === 1 ? 'M' : 'F';
  }

  function wildHap(chr) { return hap(chr, {}, null); }

  function fly(sex, chrs) {
    var c = {};
    CHRS.forEach(function (id) {
      var pair = (chrs && chrs[id]) || null;
      if (!pair) {
        c[id] = (id === 'X' && sex === 'M') ? [wildHap('X'), yHap()] : [wildHap(id), wildHap(id)];
      } else {
        c[id] = [pair[0], pair[1]];
      }
    });
    normaliseX(c);
    if (sex === 'M') c.X[1] = (c.X[1] && c.X[1].chr === 'Y') ? c.X[1] : yHap();
    return { sex: sex, chrs: c };
  }

  function cloneHap(h) {
    var al = {}, k;
    for (k in h.alleles) if (Object.prototype.hasOwnProperty.call(h.alleles, k)) al[k] = h.alleles[k];
    return hap(h.chr, al, h.balancer);
  }

  /* ---------- map distance ---------- */

  /* Kosambi: r = 0.5 * tanh(d / 50), with d in cM. Keeps r below 0.5 at any distance. */
  function recombFraction(cM) {
    var d = Math.abs(cM);
    return 0.5 * Math.tanh(d / 50);
  }

  /* ---------- meiosis ---------- */

  function lociOf(pair) {
    var seen = {}, out = [];
    [0, 1].forEach(function (i) {
      var al = pair[i].alleles, k;
      for (k in al) if (Object.prototype.hasOwnProperty.call(al, k) && !seen[k]) { seen[k] = 1; out.push(k); }
    });
    var mapped = out.filter(function (k) { var g = FCS.data.genes[k]; return g && typeof g.pos === 'number'; });
    var unmapped = out.filter(function (k) { var g = FCS.data.genes[k]; return !g || typeof g.pos !== 'number'; });
    mapped.sort(function (a, b) { return FCS.data.genes[a].pos - FCS.data.genes[b].pos; });
    return mapped.concat(unmapped);
  }

  /* Does this haplotype stop crossover products being recovered? */
  function suppressing(h) {
    if (!h.balancer) return false;
    var b = FCS.data.balancers[h.balancer];
    return !b || b.suppresses !== false;
  }

  /* Cy, Sb, Tb and the rest are only ever met riding on a balancer. Written
     loose on a plain chromosome - "Cy/+" rather than "CyO/+" - that is a
     balancer written in a hurry, not a free marker at 6.1 cM, so the chromosome
     is treated as balanced. A marker written ON a named chromosome is a
     different matter: the chromosome itself says whether it suppresses, and
     MKRS, which carries no inversions, lets its Sb and Ki come off. */
  function balancerBorne(pair) {
    var out = [];
    pair.forEach(function (h) {
      if (!h || h.balancer) return;
      Object.keys(h.alleles).forEach(function (geneId) {
        var g = FCS.data.genes[geneId];
        if (g && g.onBalancerOnly && out.indexOf(geneId) < 0) out.push(geneId);
      });
    });
    return out;
  }

  function recombines(sex, chrId, pair) {
    if (sex === 'M') return false;                       /* no meiotic recombination in males */
    if (chrId === 'Y') return false;
    var chr = FCS.data.chromosomes[chrId];
    if (!chr || !chr.recombines) return false;           /* chromosome 4 */
    if (suppressing(pair[0]) || suppressing(pair[1])) return false;
    if (pair[0].chr === 'Y' || pair[1].chr === 'Y') return false;
    if (attached(pair[0]) || attached(pair[1])) return false;
    var loci = lociOf(pair);
    if (balancerBorne(pair).length) return false;        /* a balancer marker written loose */
    /* An allele with no map position has no distance to anything, so there is
       nothing honest to recombine it against. Say so rather than invent one. */
    for (var i = 0; i < loci.length; i++) {
      var g = FCS.data.genes[loci[i]];
      if (!g || typeof g.pos !== 'number') return false;
    }
    return true;
  }

  /* Which chromosomes are recombining, and which were left alone because a map
     position is missing. One pass over the mother's chromosomes answers both,
     so the vial can say what it did as well as what it could not do. Each entry
     carries the gene ids as well as the sentence, so the app can offer to fill
     the missing positions in. */
  function linkage(f) {
    var out = [];
    if (f.sex === 'M') return out;
    CHRS.forEach(function (chrId) {
      var pair = f.chrs[chrId];
      if (suppressing(pair[0]) || suppressing(pair[1])) return;
      var chr = FCS.data.chromosomes[chrId];
      if (!chr || !chr.recombines) return;
      var loci = lociOf(pair);
      if (loci.length < 2) return;
      var borne = balancerBorne(pair);
      if (borne.length) {
        out.push({
          chr: chrId, kind: 'balancer-marker', genes: borne, known: [],
          symbols: borne.map(symbolOfGene),
          text: borne.map(symbolOfGene).join(' and ')
            + (borne.length > 1 ? ' are' : ' is')
            + ' only ever carried on a balancer, so chromosome ' + chrId
            + ' is treated as balanced here and does not recombine. Write the balancer itself '
            + '(CyO, TM3,Sb, TM6B) if that is what you mean.'
        });
        return;
      }
      var missing = [], known = [];
      loci.forEach(function (k) {
        var g = FCS.data.genes[k];
        if (g && typeof g.pos === 'number') known.push(k); else missing.push(k);
      });
      if (missing.length) {
        out.push({
          chr: chrId, kind: 'missing', genes: missing, known: known,
          symbols: missing.map(symbolOfGene),
          text: 'No map position for ' + missing.map(symbolOfGene).join(', ')
            + ' on chromosome ' + chrId + ', so ' + loci.map(symbolOfGene).join(' and ')
            + ' cannot be separated by recombination here. Look the position up on FlyBase and enter it.'
        });
        return;
      }
      var steps = [], approx = false;
      for (var i = 1; i < known.length; i++) {
        var a = FCS.data.genes[known[i - 1]], b = FCS.data.genes[known[i]];
        var d = Math.abs(b.pos - a.pos);
        if (a.approx || b.approx) approx = true;
        steps.push({ a: a.symbol, b: b.symbol, cM: d, r: recombFraction(d) });
      }
      out.push({
        chr: chrId, kind: 'recombining', genes: known, steps: steps, approx: approx,
        symbols: known.map(symbolOfGene),
        text: 'Chromosome ' + chrId + ' is recombining in the mother: '
          + steps.map(function (s) {
            return s.a + '\u2013' + s.b + ' ' + round1(s.cM) + ' cM, '
              + (s.r * 100).toFixed(1) + '% recombinant gametes';
          }).join('; ') + ' (Kosambi).' + (approx ? ' One of these positions is marked approximate.' : '')
      });
    });
    return out;
  }

  function symbolOfGene(id) {
    var g = FCS.data.genes[id];
    return g ? g.symbol : id;
  }

  function round1(x) { return Math.round(x * 10) / 10; }

  /* Kept for callers that only want the sentences. */
  function unmappedWarnings(f) {
    return linkage(f).filter(function (e) { return e.kind === 'missing'; })
      .map(function (e) { return e.text; });
  }

  function hapKey(h) {
    var ks = Object.keys(h.alleles).sort();
    return h.chr + '|' + (h.balancer || '') + '|' + ks.map(function (k) { return k + '=' + h.alleles[k]; }).join(',');
  }

  /* All gamete haplotypes for one chromosome, with probabilities. */
  function enumerateGametes(f, chrId) {
    var pair = f.chrs[chrId];
    var out;

    if (!recombines(f.sex, chrId, pair)) {
      out = [{ hap: cloneHap(pair[0]), p: 0.5 }, { hap: cloneHap(pair[1]), p: 0.5 }];
      return mergeGametes(out);
    }

    var loci = lociOf(pair);
    if (loci.length === 0) {
      return mergeGametes([{ hap: cloneHap(pair[0]), p: 0.5 }, { hap: cloneHap(pair[1]), p: 0.5 }]);
    }
    if (loci.length > 12) throw new Error('too many linked loci to enumerate: ' + loci.length);

    var rs = [];
    for (var i = 1; i < loci.length; i++) {
      var d = Math.abs(FCS.data.genes[loci[i]].pos - FCS.data.genes[loci[i - 1]].pos);
      rs.push(recombFraction(d));
    }

    var n = loci.length, total = 1 << n, results = [];
    for (var mask = 0; mask < total; mask++) {
      var p = 0.5, al = {};
      for (var j = 0; j < n; j++) {
        var side = (mask >> j) & 1;
        if (j > 0) {
          var prev = (mask >> (j - 1)) & 1;
          p *= (side === prev) ? (1 - rs[j - 1]) : rs[j - 1];
        }
        var a = pair[side].alleles[loci[j]];
        if (a) al[loci[j]] = a;
      }
      if (p > 0) {
        /* A gamete that came through unchanged is still the same named
           chromosome; only a recombinant loses the name. */
        var label = null;
        [0, 1].forEach(function (side) {
          if (!pair[side].balancer || label) return;
          if (sameAlleles(al, pair[side].alleles)) label = pair[side].balancer;
        });
        results.push({ hap: hap(pair[0].chr, al, label), p: p });
      }
    }
    return mergeGametes(results);
  }

  function sameAlleles(a, b) {
    var ka = Object.keys(a), kb = Object.keys(b), i;
    if (ka.length !== kb.length) return false;
    for (i = 0; i < ka.length; i++) if (a[ka[i]] !== b[ka[i]]) return false;
    return true;
  }

  function mergeGametes(list) {
    var byKey = {}, out = [];
    list.forEach(function (gm) {
      var k = hapKey(gm.hap);
      if (byKey[k]) byKey[k].p += gm.p;
      else { byKey[k] = { hap: gm.hap, p: gm.p }; out.push(byKey[k]); }
    });
    return out;
  }

  /* Rebuild the marker set on every copy of one balancer in a fly, keeping any
     cargo that was written on it. Used when a lab corrects what a balancer
     carries, so flies already on the bench follow the correction. */
  function refreshBalancer(f, balancerId) {
    var changed = false;
    CHRS.forEach(function (chrId) {
      f.chrs[chrId].forEach(function (h, i) {
        if (h.balancer !== balancerId) return;
        var cargo = {};
        Object.keys(h.alleles).forEach(function (gene) {
          if (FCS.data.isUnknown(h.alleles[gene])) cargo[gene] = h.alleles[gene];
        });
        var fresh = balancerHap(balancerId);
        Object.keys(cargo).forEach(function (gene) { fresh.alleles[gene] = cargo[gene]; });
        f.chrs[chrId][i] = fresh;
        changed = true;
      });
    });
    return changed;
  }

  /* ---------- viability ---------- */

  /* Hemizygous means the partner has nothing to say about this gene - which is
     the usual case for a male's X. A marked Y is the exception: what it carries
     is really there, and is expressed. */
  function allelePair(f, chrId, geneId) {
    var pair = f.chrs[chrId];
    var a0 = pair[0].alleles[geneId] || null;
    var onY = pair[1].chr === 'Y';
    var a1 = onY ? (pair[1].alleles[geneId] || undefined) : (pair[1].alleles[geneId] || null);
    return { a0: a0, a1: a1, hemizygous: onY && a1 === undefined };
  }

  function genesOn(f, chrId) {
    return lociOf(f.chrs[chrId]);
  }

  function viability(f) {
    /* Dose of the X, before anything else: none is nothing to live on, three is
       a metafemale. Both turn up in every attached-X cross, which is why half
       that vial is missing and nothing has gone wrong. */
    var dose = xDose(f.chrs.X[0]) + xDose(f.chrs.X[1]);
    if (dose === 0) return { alive: false, reason: 'no X chromosome' };
    if (dose >= 3) return { alive: false, reason: dose + ' doses of the X (a metafemale)' };

    for (var ci = 0; ci < CHRS.length; ci++) {
      var chrId = CHRS[ci];
      var pair = f.chrs[chrId];

      /* A balancer carries its own recessive lethal, so two copies of the SAME
         balancer die. Two DIFFERENT balancer or marked chromosomes over each
         other do not: each one's lethal is covered by the other, which is why
         TM3,Sb/TM6B, MKRS/TM6B and Gla/CyO are stocks you can keep. (A few real
         pairs do share a lethal; the engine assumes they do not.) */
      if (pair[0].balancer && pair[1].balancer && pair[0].balancer === pair[1].balancer) {
        var b0 = FCS.data.balancers[pair[0].balancer];
        if (b0 && b0.lethal === 'recessive') {
          return { alive: false, reason: 'homozygous for ' + pair[0].balancer
            + ', which carries its own recessive lethal' };
        }
      }

      var loci = genesOn(f, chrId);
      for (var gi = 0; gi < loci.length; gi++) {
        var geneId = loci[gi];
        var ap = allelePair(f, chrId, geneId);
        var al0 = ap.a0 ? FCS.data.alleles[ap.a0] : null;
        var al1 = ap.a1 ? FCS.data.alleles[ap.a1] : null;

        if ((al0 && al0.lethal === 'dominant') || (al1 && al1.lethal === 'dominant')) {
          return { alive: false, reason: 'dominant lethal ' + (al0 && al0.lethal === 'dominant' ? al0.symbol : al1.symbol) };
        }
        if (ap.hemizygous) {
          if (al0 && al0.lethal === 'recessive') {
            return { alive: false, reason: 'hemizygous for ' + al0.symbol + ' (lethal in males)' };
          }
        } else if (al0 && al1 && al0.lethal === 'recessive' && al1.lethal === 'recessive') {
          return { alive: false, reason: 'homozygous for lethal ' + al0.symbol };
        }
      }
    }
    return { alive: true, reason: null };
  }

  /* ---------- genotype text ---------- */

  function orderedSymbols(h, skip) {
    var ks = Object.keys(h.alleles).filter(function (k) { return !skip || !skip[k]; });
    var mapped = ks.filter(function (k) { return typeof FCS.data.genes[k].pos === 'number'; });
    var unmapped = ks.filter(function (k) { return typeof FCS.data.genes[k].pos !== 'number'; });
    mapped.sort(function (a, b) { return FCS.data.genes[a].pos - FCS.data.genes[b].pos; });
    return mapped.concat(unmapped).map(function (k) { return FCS.data.alleles[h.alleles[k]].symbol; });
  }

  function hapString(h) {
    if (h.chr === 'Y') return h.yName || 'Y';
    if (h.balancer) {
      var b = FCS.data.balancers[h.balancer], skip = {};
      (b ? b.markers : []).forEach(function (aid) {
        var al = FCS.data.alleles[aid];
        if (al) skip[al.gene] = true;
      });
      var extra = orderedSymbols(h, skip);
      return extra.length ? h.balancer + ',' + extra.join(',') : h.balancer;
    }
    var syms = orderedSymbols(h, null);
    return syms.length ? syms.join(',') : '+';
  }

  /* Written the way it is written at the bench: what you are carrying on the
     left, what is balancing it on the right. A cross can deal the balancer into
     either slot, and "TM6C/myGene" reads backwards to anyone who pushes flies. */
  function readOrder(pair) {
    var a = pair[0], b = pair[1];
    if (b.chr === 'Y') return [a, b];                 /* the X always leads */
    if (a.chr === 'Y') return [b, a];
    if (a.balancer && !b.balancer) return [b, a];     /* the balancer goes second */
    return [a, b];
  }

  /* The pieces of a genotype, so the app can draw a balancer differently from
     the gene you are actually following. genotypeString is built from this, so
     the two can never drift apart. */
  function genotypeParts(f) {
    return CHRS.map(function (id) {
      var pair = readOrder(f.chrs[id]);
      var sides = pair.map(function (h) {
        return {
          text: hapString(h), balancer: !!h.balancer, chr: h.chr,
          /* A side is "yours" when it carries at least one gene that is not in
             the shipped library. A balancer, a Y, a wild-type chromosome and
             the classical markers are all somebody else's. */
          yours: !h.balancer && h.chr !== 'Y' && Object.keys(h.alleles).some(function (gene) {
            return FCS.data.isYours(h.alleles[gene]);
          })
        };
      });
      return { chr: id, sides: sides, text: sides[0].text + '/' + sides[1].text };
    }).filter(function (part) {
      return !(part.text === '+/+' && part.chr === '4');
    });
  }

  function genotypeString(f) {
    return genotypeParts(f).map(function (p) { return p.text; }).join('; ');
  }

  function genotypeKey(f) {
    return CHRS.map(function (id) {
      var pair = f.chrs[id];
      var a = hapKey(pair[0]), b = hapKey(pair[1]);
      return a < b ? a + '//' + b : b + '//' + a;
    }).join(' ; ') + ' sex=' + f.sex;
  }

  /* ---------- the cross ---------- */

  function zygote(mGametes, pGametes) {
    var sex = sexOf([mGametes.X, pGametes.X]);
    var chrs = {};
    CHRS.forEach(function (id) {
      chrs[id] = [cloneHap(mGametes[id]), cloneHap(pGametes[id])];
    });
    normaliseX(chrs);
    return { sex: sex, chrs: chrs };
  }

  /* The X always comes first and the Y second, whichever parent supplied which.
     A son of an attached-X mother gets his X from his father, and without this
     his own X would sit in the partner slot, read as heterozygous, and show
     none of what he is carrying. */
  function normaliseX(chrs) {
    var pair = chrs.X;
    if (pair && pair[0] && pair[1] && pair[0].chr === 'Y' && pair[1].chr !== 'Y') {
      chrs.X = [pair[1], pair[0]];
    }
  }

  /* Exact offspring distribution. Returns live classes with renormalised
   * probabilities, plus the dead classes so the app can show what is missing. */
  function cross(mother, father, opts) {
    opts = opts || {};
    if (mother.sex !== 'F') throw new Error('the first parent must be female');
    if (father.sex !== 'M') throw new Error('the second parent must be male');

    var mSets = {}, pSets = {}, combos = 1;
    CHRS.forEach(function (id) {
      mSets[id] = enumerateGametes(mother, id);
      pSets[id] = enumerateGametes(father, id);
      combos *= mSets[id].length * pSets[id].length;
    });
    if (combos > 200000) throw new Error('cross too complex to enumerate (' + combos + ' combinations)');

    var live = {}, dead = {}, liveP = 0, deadP = 0;

    function walk(i, mPick, pPick, p) {
      if (p === 0) return;
      if (i === CHRS.length) {
        var z = zygote(mPick, pPick);
        var v = viability(z);
        var key = genotypeKey(z);
        var bag = v.alive ? live : dead;
        if (bag[key]) bag[key].p += p;
        else bag[key] = { fly: z, p: p, key: key, reason: v.reason };
        if (v.alive) liveP += p; else deadP += p;
        return;
      }
      var id = CHRS[i];
      mSets[id].forEach(function (mg) {
        pSets[id].forEach(function (pg) {
          mPick[id] = mg.hap; pPick[id] = pg.hap;
          walk(i + 1, mPick, pPick, p * mg.p * pg.p);
        });
      });
    }
    walk(0, {}, {}, 1);

    var liveList = Object.keys(live).map(function (k) { return live[k]; });
    var deadList = Object.keys(dead).map(function (k) { return dead[k]; });
    liveList.forEach(function (c) { c.pRaw = c.p; c.p = liveP > 0 ? c.p / liveP : 0; });
    liveList.sort(function (a, b) { return b.p - a.p; });
    deadList.sort(function (a, b) { return b.p - a.p; });

    var link = linkage(mother).concat(linkage(father));
    return {
      classes: liveList, dead: deadList, survival: liveP, lost: deadP,
      linkage: link,
      notes: link.map(function (e) { return e.text; })
    };
  }

  /* Draw n flies from a cross result, in the proportions that survive. */
  function sample(result, n, seed) {
    var rand = rngFrom(seed), out = [], i, j, r, acc;
    for (i = 0; i < n; i++) {
      r = rand(); acc = 0;
      for (j = 0; j < result.classes.length; j++) {
        acc += result.classes[j].p;
        if (r <= acc) break;
      }
      if (j >= result.classes.length) j = result.classes.length - 1;
      out.push({ fly: result.classes[j].fly, classIndex: j });
    }
    return out;
  }

  FCS.genetics = {
    CHRS: CHRS, AUTOSOMES: AUTOSOMES,
    hap: hap, balancerHap: balancerHap, yHap: yHap, wildHap: wildHap,
    fly: fly, cloneHap: cloneHap,
    recombFraction: recombFraction, xDose: xDose, sexOf: sexOf, attached: attached,
    enumerateGametes: enumerateGametes,
    viability: viability,
    genotypeString: genotypeString, genotypeKey: genotypeKey, hapString: hapString,
    genotypeParts: genotypeParts,
    allelePair: allelePair, genesOn: genesOn,
    cross: cross, sample: sample, rngFrom: rngFrom, refreshBalancer: refreshBalancer, suppressing: suppressing,
    unmappedWarnings: unmappedWarnings, linkage: linkage
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
