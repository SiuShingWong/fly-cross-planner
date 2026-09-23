/* Fly Cross Planner - working backwards.
 *
 * Give it the fly you want and it searches for a crossing scheme that reaches
 * it from stocks you hold. Every step is checked by running the cross through
 * the engine, so a scheme it reports is one the simulator itself can carry out,
 * and every class it asks you to pick is one you can actually tell apart.
 *
 * Exports FCS.planner — plan, deriveOneGeneration, reached, registerStockAlleles,
 *   spellingsLike, forgetStocks (PARKED: not loaded by index.html)
 * Needs FCS.data, FCS.genetics, FCS.parse, FCS.phenotype, FCS.stockList.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};

  /* ---------- identity ---------- */

  function key(f) {
    return FCS.genetics.CHRS.map(function (id) {
      var pair = f.chrs[id];
      var a = hk(pair[0]), b = hk(pair[1]);
      return a < b ? a + '//' + b : b + '//' + a;
    }).join(' ; ');
  }

  function hk(h) {
    var ks = Object.keys(h.alleles).sort();
    return h.chr + '|' + (h.balancer || '') + '|' + ks.map(function (k) { return k + '=' + h.alleles[k]; }).join(',');
  }

  function chrMatches(f, target, chrId) {
    var a = f.chrs[chrId], b = target.chrs[chrId];
    var ka = [hk(a[0]), hk(a[1])].sort().join('//');
    var kb = [hk(b[0]), hk(b[1])].sort().join('//');
    return ka === kb;
  }

  /* Every allele and balancer written on a fly. */
  function partsOf(f) {
    var out = {};
    FCS.genetics.CHRS.forEach(function (id) {
      f.chrs[id].forEach(function (h) {
        if (h.balancer) out['bal:' + h.balancer] = true;
        Object.keys(h.alleles).forEach(function (g) { out[h.alleles[g]] = true; });
      });
    });
    return out;
  }

  /* ---------- the pool of stocks to start from ---------- */

  /* A cheap text pass over the stock sheet, before anything is parsed
     properly: it works out which chromosome each of your alleles lives on, from
     the balancer written beside it or from where it sits in the genotype. That
     way a target typed as "Cnnf/Cnnf" lands on chromosome 2 like the stocks,
     instead of on the X by default. */
  var ORDER = ['X', '2', '3', '4'];

  /* symbol -> how many stocks are written with exactly that spelling */
  var spellings = null;

  function registerStockAlleles(rows) {
    var withBalancer = [], byPosition = [];
    spellings = {};
    (rows || []).forEach(function (st) {
      String(st.g || '').split(';').forEach(function (seg, i) {
        var chrFromBalancer = null;
        var tokens = [];
        /* Tokenise exactly as the parser does, or the spellings offered here
           would be ones it never produces. */
        seg.split('/').forEach(function (side) {
          FCS.parse.splitTop(side).forEach(function (tok) { tokens.push(tok); });
        });
        tokens.forEach(function (tok) {
          var bal = FCS.parse.lookupBalancer(tok);
          if (bal) chrFromBalancer = FCS.data.balancers[bal].chr;
        });
        var chr = chrFromBalancer || ORDER[i] || '4';
        tokens.forEach(function (tok) {
          if (FCS.parse.lookupBalancer(tok) || FCS.parse.lookupCompound(tok)) return;
          if (tok === '+' || /^#\d+$/.test(tok)) return;
          var rec = spellings[tok] || (spellings[tok] = { symbol: tok, held: 0, total: 0 });
          rec.total++;
          if (st.s) rec.held++;
          if (FCS.parse.lookupAllele(tok)) return;
          (chrFromBalancer ? withBalancer : byPosition).push([tok, chr]);
        });
      });
    });
    /* A balancer beside an allele is better evidence than its position, so
       those are registered first and win. */
    withBalancer.concat(byPosition).forEach(function (row) {
      FCS.data.ensureAllele(row[0], row[1]);
    });
  }

  /* The stock sheet spells the same gene many different ways: 160 for ana2,
     195 for cnn. Typing the bare gene name finds nothing, so offer the
     spellings that are actually in the sheet. */
  /* The list may be the one this copy ships with or one you loaded yourself;
     stockList() is whichever is in use. */
  function stockRows() { return FCS.stockList ? FCS.stockList() : (FCS.stocks || []); }

  /* Called when the list is swapped: the spelling index belongs to a list. */
  function forgetStocks() { spellings = null; }

  function spellingsLike(text, limit) {
    if (!spellings) registerStockAlleles(stockRows());
    var q = String(text || '').trim().toLowerCase();
    if (!q) return [];
    var out = [];
    Object.keys(spellings).forEach(function (sym) {
      if (sym.toLowerCase().indexOf(q) >= 0) out.push(spellings[sym]);
    });
    out.sort(function (a, b) {
      if (b.held !== a.held) return b.held - a.held;
      if (b.total !== a.total) return b.total - a.total;
      return a.symbol.length - b.symbol.length;
    });
    return out.slice(0, limit || 12);
  }

  /* Is this allele ever on a chromosome by itself? If every stock has it in
     cis with something else, you cannot get it alone without recombining. */
  function alwaysInCis(part, pool) {
    var companions = {}, sawAlone = false, sawAny = false;
    pool.forEach(function (st) {
      FCS.genetics.CHRS.forEach(function (id) {
        st.fly.chrs[id].forEach(function (h) {
          var ids = Object.keys(h.alleles).map(function (g) { return h.alleles[g]; });
          if (ids.indexOf(part) < 0) return;
          sawAny = true;
          var others = ids.filter(function (a) { return a !== part; });
          if (!others.length) sawAlone = true;
          others.forEach(function (a) {
            var al = FCS.data.alleles[a];
            companions[al ? al.symbol : a] = true;
          });
        });
      });
    });
    if (!sawAny || sawAlone) return null;
    return Object.keys(companions);
  }

  function makeEntry(name, genotype, source, note, seen, out) {
    var f = FCS.parse.parse(genotype, 'F');
    if (!f.ok || !f.modelled) return;
    var k = key(f.fly);
    if (seen[k]) return;
    seen[k] = true;
    out.push({ name: name, genotype: genotype, source: source, note: note || '', fly: f.fly, key: k });
  }

  /* Only the stocks that could possibly matter get parsed: the ones whose text
     mentions something the target wants, plus the standard tools. Parsing all
     four thousand takes seconds; this takes a moment. */
  function buildPool(opts) {
    opts = opts || {};
    var out = [], seen = {};
    var rows = stockRows();
    registerStockAlleles(rows);

    var needles = (opts.needles || []).map(function (n) { return String(n).toLowerCase(); });
    function wanted(st) {
      if (!needles.length) return true;
      var hay = (st.g + ' ' + st.n).toLowerCase();
      for (var i = 0; i < needles.length; i++) if (hay.indexOf(needles[i]) >= 0) return true;
      return false;
    }

    rows.forEach(function (st) { if (st.s && wanted(st)) makeEntry(st.n, st.g, 'held', st.d, seen, out); });
    if (opts.includeArchived !== false) {
      rows.forEach(function (st) { if (!st.s && wanted(st)) makeEntry(st.n, st.g, 'archived', st.d, seen, out); });
    }
    if (opts.includeTools !== false) {
      (FCS.toolStocks || []).forEach(function (st) { makeEntry(st.n, st.g, 'tool', st.d, seen, out); });
    }
    return out;
  }

  /* The symbols worth searching the sheet for. */
  function needlesFor(target) {
    var out = [];
    Object.keys(wantedParts(target)).forEach(function (k) {
      if (k.indexOf('bal:') === 0) return;
      var a = FCS.data.alleles[k];
      out.push(a ? a.symbol : k);
    });
    return out;
  }

  /* ---------- choosing what to start from ---------- */

  var RANK = { held: 0, tool: 1, archived: 2 };

  /* The parts that identify this target: its own alleles and balancers, minus
     the dominant markers that ride on balancers anyway. */
  function wantedParts(target) {
    var parts = partsOf(target), out = {}, markers = {};
    Object.keys(FCS.data.balancers).forEach(function (id) {
      FCS.data.balancers[id].markers.forEach(function (aid) { markers[aid] = true; });
    });
    Object.keys(parts).forEach(function (k) {
      if (!markers[k]) out[k] = true;
    });
    return out;
  }

  /* Parts that cost nothing to have around: balancers, their markers, the
     dominant markers people keep balancer stocks on, and a white background. */
  function freeParts() {
    var free = {};
    Object.keys(FCS.data.balancers).forEach(function (id) {
      free['bal:' + id] = true;
      FCS.data.balancers[id].markers.forEach(function (aid) { free[aid] = true; });
    });
    ['If[1]', 'Sco[1]', 'Gla[1]', 'Dr[1]', 'Pr[1]', 'w[1118]'].forEach(function (a) { free[a] = true; });
    return free;
  }

  function countBalancers(f) {
    var n = 0;
    FCS.genetics.CHRS.forEach(function (id) {
      if (f.chrs[id][0].balancer || f.chrs[id][1].balancer) n++;
    });
    return n;
  }

  /* For every distinctive part of the target, the tidiest stock that carries
     it: one you hold, carrying as little else as possible. Plus the tools
     needed to balance and to supply a plain chromosome. */
  function chooseStarts(target, pool, limit, constrain) {
    constrain = (constrain && constrain.length) ? constrain : FCS.genetics.CHRS.slice();
    var want = wantedParts(target);
    var free = freeParts();
    var wantList = Object.keys(want).filter(function (k) { return k.indexOf('bal:') !== 0; });

    function extras(st) {
      var parts = partsOf(st.fly), n = 0;
      Object.keys(parts).forEach(function (k) { if (!want[k] && !free[k]) n++; });
      return n;
    }

    function byQuality(a, b) {
      if (RANK[a.source] !== RANK[b.source]) return RANK[a.source] - RANK[b.source];
      var ea = extras(a), eb = extras(b);
      if (ea !== eb) return ea - eb;
      var pa = Object.keys(partsOf(a.fly)).length, pb = Object.keys(partsOf(b.fly)).length;
      if (pa !== pb) return pa - pb;
      return a.genotype.length - b.genotype.length;
    }

    var picked = [], seen = {}, missing = [];
    function take(st) {
      if (!st || seen[st.key]) return false;
      seen[st.key] = true; picked.push(st); return true;
    }

    /* A stock that already carries one of the chromosomes you asked for is
       worth far more than one that merely mentions the right gene: it saves a
       whole generation of putting the thing back over its balancer. */
    constrain.forEach(function (chr) {
      var cands = pool.filter(function (st) { return chrMatches(st.fly, target, chr); });
      cands.sort(byQuality);
      take(cands[0]);
    });

    var havePart = {};
    picked.forEach(function (st) {
      Object.keys(partsOf(st.fly)).forEach(function (k) { havePart[k] = true; });
    });

    wantList.forEach(function (part) {
      if (havePart[part]) return;
      var cands = pool.filter(function (st) { return partsOf(st.fly)[part]; });
      cands.sort(byQuality);
      if (!cands.length) { missing.push(part); return; }
      if (take(cands[0])) {
        Object.keys(partsOf(cands[0].fly)).forEach(function (k) { havePart[k] = true; });
      }
    });

    ['tool: w[1118]', 'tool: double balancer', 'tool: If/CyO', 'tool: MKRS/TM6B'].forEach(function (n) {
      if (picked.length >= (limit || 7)) return;
      take(pool.filter(function (x) { return x.name === n; })[0]);
    });

    picked.missing = missing;
    return picked;
  }

  /* ---------- the search ---------- */

  function bothSexes(fly) {
    var G = FCS.genetics;
    var female = G.fly('F', fly.chrs);
    var male = G.fly('M', { X: [fly.chrs.X[0], G.yHap()], '2': fly.chrs['2'], '3': fly.chrs['3'], '4': fly.chrs['4'] });
    return [female, male];
  }

  function score(items, target, constrain) {
    var best = 0;
    items.forEach(function (it) {
      var n = 0;
      constrain.forEach(function (id) { if (chrMatches(it.fly, target, id)) n++; });
      if (n > best) best = n;
    });
    return best;
  }

  /* The user asks for a fly, not for a genome. Chromosomes they did not write
     about are left alone rather than required to be wild type. */
  function reached(fly, target, constrain) {
    for (var i = 0; i < constrain.length; i++) {
      if (!chrMatches(fly, target, constrain[i])) return false;
    }
    return true;
  }

  function stateKey(items) {
    return items.map(function (i) { return i.key; }).sort().join(' + ');
  }

  function plan(target, opts) {
    opts = opts || {};
    var first = search(target, opts, true);
    if (first.ok || opts.strictOnly) return first;
    var second = search(target, opts, false);
    if (second.ok) {
      second.relaxed = true;
      return second;
    }
    second.triedBothWays = true;
    if (!second.missingParts) {
      second.reason = 'No scheme found within ' + (opts.maxGenerations || 4)
        + ' generations, even allowing steps where several genotypes look alike.';
      /* Say why, when the reason is that something can never be had on its own. */
      var stuck = [];
      if (second.pool) {
        Object.keys(wantedParts(target)).forEach(function (part) {
          if (part.indexOf('bal:') === 0) return;
          var cis = alwaysInCis(part, second.pool);
          if (cis && cis.length) {
            var sym = FCS.data.alleles[part] ? FCS.data.alleles[part].symbol : part;
            stuck.push(sym + ' is only ever written in cis with ' + cis.join(', ')
              + ', so it cannot be had on its own without a recombination step.');
          }
        });
      }
      second.obstacles = stuck;

      /* The same gene is spelled many ways in the sheet. If another spelling is
         far commoner than the one typed, that is usually the real problem. */
      var alts = {};
      Object.keys(wantedParts(target)).forEach(function (part) {
        if (part.indexOf('bal:') === 0) return;
        var al = FCS.data.alleles[part];
        var sym = al ? al.symbol : part;
        var stem = /^[A-Za-z]+/.exec(sym);
        if (!stem) return;
        var others = spellingsLike(stem[0], 8).filter(function (r) {
          return r.symbol !== sym && r.held > 0;
        });
        if (others.length) alts[sym] = others;
      });
      if (Object.keys(alts).length) second.spellingHints = alts;
    }
    return second;
  }

  /* strict: every class you are asked to pick must contain exactly one
     genotype. Relaxed: a class may hold look-alikes, and the scheme says how
     many you would have to test. */
  function search(target, opts, strict) {
    opts = opts || {};
    var G = FCS.genetics, P = FCS.phenotype;
    var maxGen = opts.maxGenerations || 4;
    var beam = opts.beam || 32;
    var maxAlike = strict ? 1 : (opts.maxLookAlikes || 4);
    var pool = opts.pool || buildPool(Object.assign({}, opts, { needles: needlesFor(target) }));
    var constrain = (opts.constrain && opts.constrain.length) ? opts.constrain : G.CHRS.slice();
    var starts = opts.starts || chooseStarts(target, pool, opts.startLimit || 7, constrain);
    var deadline = Date.now() + (opts.timeLimitMs || 9000);

    if (starts.missing && starts.missing.length) {
      var hints = {};
      starts.missing.forEach(function (part) {
        var sym = FCS.data.alleles[part] ? FCS.data.alleles[part].symbol : part;
        hints[sym] = spellingsLike(sym, 10).filter(function (r) { return r.symbol !== sym; });
      });
      return { ok: false, starts: starts, missingParts: starts.missing, spellingHints: hints,
        reason: 'Nothing in the stock list is spelled ' + starts.missing.join(', ') + '.' };
    }
    if (!starts.length) {
      return { ok: false, reason: 'No stock in the list carries any part of that genotype.', starts: [] };
    }

    var have = pool.filter(function (st) { return reached(st.fly, target, constrain); })
      .sort(function (a, b) { return RANK[a.source] - RANK[b.source]; })[0];
    if (have) {
      return { ok: true, steps: [], starts: [have], already: have,
        reason: 'You already have this: ' + have.name + ' (' + have.genotype + ').' };
    }

    var open = [];
    var items = [];
    starts.forEach(function (st) {
      /* A stock really does give you both sexes. */
      bothSexes(st.fly).forEach(function (f) {
        items.push({ fly: f, key: key(f), sex: f.sex, from: st.name, origin: st });
      });
    });
    open.push({ items: items, steps: [], depth: 0, score: score(items, target, constrain) });

    var seen = {};
    seen[stateKey(items)] = true;

    for (var depth = 0; depth < maxGen; depth++) {
      var next = [];
      for (var si = 0; si < open.length; si++) {
        if (Date.now() > deadline) {
          return { ok: false, starts: starts, pool: pool, timedOut: true, strict: strict,
            reason: 'Gave up after ' + Math.round((opts.timeLimitMs || 9000) / 1000)
              + ' seconds without finding a scheme.' };
        }
        var state = open[si];
        var mums = state.items.filter(function (i) { return i.sex === 'F'; });
        var dads = state.items.filter(function (i) { return i.sex === 'M'; });

        for (var mi = 0; mi < mums.length; mi++) {
          for (var di = 0; di < dads.length; di++) {
            var mum = mums[mi], dad = dads[di];
            var res;
            try { res = G.cross(mum.fly, dad.fly); } catch (e) { continue; }

            /* One cross gives you one vial, and you may keep any class you can
               tell apart in it. So a cross is a single move, not one move per
               class, which is both truer and far cheaper to search. */
            var products = [], goal = null;
            P.classes(res).forEach(function (cls) {
              if (cls.genotypes.length > maxAlike) return;
              cls.genotypes.forEach(function (g) {
                var got = g.fly;
                var share = cls.p > 0 ? g.p / cls.p : 1;
                var prod = {
                  fly: got, key: key(got), sex: got.sex,
                  label: cls.phenotype.label, fraction: cls.p, share: share,
                  ambiguous: cls.genotypes.length > 1,
                  amongN: cls.genotypes.length,
                  lookAlikes: cls.genotypes.filter(function (x) { return x.fly !== got; })
                    .map(function (x) { return G.genotypeString(x.fly); }),
                  genotype: G.genotypeString(got)
                };
                products.push(prod);
                if (!goal && reached(got, target, constrain)) goal = prod;
              });
            });
            if (!products.length) continue;

            var step = { mother: mum, father: dad, products: products,
                         lost: res.lost, notes: res.notes || [] };
            var steps = state.steps.concat([step]);
            if (goal) {
              step.wanted = goal;
              return finish({ ok: true, steps: steps, starts: starts, pool: pool, strict: strict });
            }

            var fresh = products.filter(function (pr) {
              return !state.items.some(function (i) { return i.key === pr.key && i.sex === pr.sex; });
            });
            if (!fresh.length) continue;

            var newItems = state.items.concat(fresh.map(function (pr) {
              return { fly: pr.fly, key: pr.key, sex: pr.sex, from: 'cross ' + steps.length, product: pr };
            }));
            if (newItems.length > (opts.maxBench || 20)) {
              var keep = state.items.slice(0, items.length);
              var rest = newItems.slice(items.length);
              rest.sort(function (x, y) {
                return score([y], target, constrain) - score([x], target, constrain);
              });
              newItems = keep.concat(rest.slice(0, (opts.maxBench || 20) - keep.length));
            }

            var sk = stateKey(newItems);
            if (seen[sk]) continue;
            seen[sk] = true;

            var murk = 0;
            steps.forEach(function (x) { if (x.wanted && x.wanted.ambiguous) murk++; });
            next.push({ items: newItems, steps: steps, depth: depth + 1, murk: murk,
              score: score(newItems, target, constrain) });
          }
        }
      }
      if (!next.length) break;
      next.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        if ((a.murk || 0) !== (b.murk || 0)) return (a.murk || 0) - (b.murk || 0);
        return a.steps.length - b.steps.length;
      });
      open = next.slice(0, beam);
    }

    return { ok: false, starts: starts, pool: pool, strict: strict,
      reason: strict
        ? 'No scheme found in which every step can be told apart by eye.'
        : 'No scheme found within ' + maxGen + ' generations from the stocks available.' };
  }

  /* Each cross produced a whole vial. Work backwards to say which class you
     actually needed to keep from each one, and drop crosses nothing used. */
  function finish(result) {
    var steps = result.steps;
    var needed = {};
    var last = steps[steps.length - 1];
    if (last && last.wanted) needed[last.wanted.key + last.wanted.sex] = true;

    for (var i = steps.length - 1; i >= 0; i--) {
      var st = steps[i];
      if (!st.wanted) {
        var used = st.products.filter(function (pr) { return needed[pr.key + pr.sex]; });
        st.wanted = used[0] || null;
      }
      if (st.wanted) {
        needed[st.mother.key + 'F'] = true;
        needed[st.father.key + 'M'] = true;
      }
    }
    result.steps = steps.filter(function (st) { return st.wanted; });
    result.ambiguousSteps = result.steps.filter(function (st) { return st.wanted.ambiguous; }).length;

    /* Only the stocks the scheme actually uses; the rest were considered and
       not needed, which is not worth printing. */
    var used = [], seenStart = {};
    result.steps.forEach(function (st) {
      [st.mother, st.father].forEach(function (parent) {
        if (!parent.origin || seenStart[parent.origin.key]) return;
        seenStart[parent.origin.key] = true;
        used.push(parent.origin);
      });
    });
    result.usedStarts = used;
    return result;
  }

  /* ---------- working back one generation ---------- */

  /* The standard partner for each chromosome: the balancer you would put the
     wanted chromosome over, and the marked balancer stock you would cross it
     to. Listed best first; alternatives are tried when the first does not make
     the wanted class scorable on its own. */
  var PARTNERS = {
    X: ['FM7a'],
    '2': ['CyO', 'SM6a', 'SM5'],
    '3': ['TM6B', 'TM3,Sb', 'TM6C']
  };

  function balancerHapFor(id) { return FCS.genetics.balancerHap(id); }

  /* Build one parent: the wanted homologue on each chromosome, with a balancer
     opposite it. Chromosomes the target says nothing about are left wild. */
  function makeParent(target, constrain, side, choice, sex) {
    var G = FCS.genetics;
    var chrs = {};
    G.CHRS.forEach(function (id) {
      var pair = target.chrs[id];
      if (constrain.indexOf(id) < 0) {
        chrs[id] = [G.cloneHap(pair[0]), G.cloneHap(pair[1])];
        return;
      }
      var wanted = G.cloneHap(pair[side]);
      if (wanted.chr === 'Y') { chrs[id] = [G.cloneHap(pair[0]), G.yHap()]; return; }
      var bal = choice[id];
      /* If the wanted homologue is itself a balancer, the partner has to be a
         chromosome you can tell from it, not another copy of the same one. */
      var partner = wanted.balancer ? markedPartner(id, wanted.balancer) : balancerHapFor(bal);
      chrs[id] = [wanted, partner];
    });
    return G.fly(sex, chrs);
  }

  /* A chromosome carrying a dominant marker, to sit opposite a balancer. */
  var MARKED = { '2': ['Sco[1]', 'If[1]', 'Gla[1]'], '3': ['Dr[1]', 'Pr[1]'], X: ['B[1]'] };

  function markedPartner(chrId, balancerId) {
    var G = FCS.genetics;
    var list = MARKED[chrId] || [];
    for (var i = 0; i < list.length; i++) {
      var al = FCS.data.alleles[list[i]];
      if (!al) continue;
      var h = G.hap(chrId, {}, null);
      h.alleles[al.gene] = al.id;
      return h;
    }
    return G.wildHap(chrId);
  }

  function choices(constrain) {
    /* Every combination of balancer per constrained chromosome, best first. */
    var lists = constrain.map(function (id) { return (PARTNERS[id] || ['CyO']).slice(); });
    var out = [{}];
    constrain.forEach(function (id, i) {
      var next = [];
      out.forEach(function (base) {
        lists[i].forEach(function (bal) {
          var copy = {}, k;
          for (k in base) copy[k] = base[k];
          copy[id] = bal;
          next.push(copy);
        });
      });
      out = next;
    });
    return out.slice(0, 27);
  }

  /* Work back one generation: which two parents would give this fly, and which
     class of their offspring you would keep. */
  function deriveOneGeneration(target, constrain, opts) {
    opts = opts || {};
    var G = FCS.genetics, P = FCS.phenotype;
    constrain = (constrain && constrain.length) ? constrain : G.CHRS.slice();
    constrain = constrain.filter(function (id) {
      var pair = target.chrs[id];
      return Object.keys(pair[0].alleles).length || Object.keys(pair[1].alleles).length
        || pair[0].balancer || pair[1].balancer;
    });
    if (!constrain.length) {
      return { ok: false, reason: 'That target is wild type everywhere, so there is nothing to build.' };
    }

    var best = null;
    choices(constrain).forEach(function (choice) {
      var mother = makeParent(target, constrain, 0, choice, 'F');
      var father = makeParent(target, constrain, 1, choice, 'M');
      var res;
      try { res = G.cross(mother, father); } catch (e) { return; }
      var classes = P.classes(res);
      for (var i = 0; i < classes.length; i++) {
        var cls = classes[i];
        var hit = cls.genotypes.filter(function (g) { return reached(g.fly, target, constrain); })[0];
        if (!hit) continue;
        var share = cls.p > 0 ? hit.p / cls.p : 1;
        var cand = {
          mother: mother, father: father, result: res,
          label: cls.phenotype.label, sex: cls.phenotype.sex,
          fraction: cls.p, share: share, amongN: cls.genotypes.length,
          lookAlikes: cls.genotypes.filter(function (g) { return g !== hit; })
            .map(function (g) { return G.genotypeString(g.fly); }),
          genotype: G.genotypeString(hit.fly), choice: choice, lost: res.lost
        };
        if (!best || better(cand, best)) best = cand;
      }
    });

    if (!best) return { ok: false, reason: 'Could not work out a pair of parents for that fly.' };
    best.ok = true;
    best.constrain = constrain;
    return best;
  }

  function better(a, b) {
    if ((a.amongN === 1) !== (b.amongN === 1)) return a.amongN === 1;
    if (Math.abs(a.fraction - b.fraction) > 0.001) return a.fraction > b.fraction;
    return false;
  }

  /* Do you already have this parent? Matched on the chromosomes that matter. */
  function findStock(fly, constrain, pool) {
    var hits = pool.filter(function (st) { return reached(st.fly, fly, constrain); });
    hits.sort(function (a, b) { return RANK[a.source] - RANK[b.source]; });
    return hits[0] || null;
  }

  FCS.planner = {
    deriveOneGeneration: deriveOneGeneration, findStock: findStock,
    plan: plan, buildPool: buildPool, chooseStarts: chooseStarts, key: key, partsOf: partsOf,
    registerStockAlleles: registerStockAlleles, needlesFor: needlesFor,
    forgetStocks: forgetStocks, stockRows: stockRows,
    spellingsLike: spellingsLike, alwaysInCis: alwaysInCis,
    reached: reached, wantedParts: wantedParts
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
