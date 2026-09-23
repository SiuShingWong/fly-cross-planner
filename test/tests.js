/* Fly Cross Planner - engine tests.
 * Run in node:  node test/run.js
 * Run in browser: open test/test.html
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};

  function run() {
    var G = FCS.genetics, P = FCS.phenotype, results = [];

    function test(name, fn) {
      try { fn(); results.push({ name: name, pass: true }); }
      catch (e) { results.push({ name: name, pass: false, message: e.message }); }
    }
    function near(actual, expected, tol, what) {
      if (Math.abs(actual - expected) > tol) {
        throw new Error((what || '') + ' expected ' + expected + ', got ' + actual.toFixed(4));
      }
    }
    function phenP(result, label) {
      return P.classes(result).filter(function (c) { return c.phenotype.label === label; })
        .reduce(function (s, c) { return s + c.p; }, 0);
    }
    function autosome(chr, alleles) { return G.hap(chr, alleles, null); }

    /* 1. Monohybrid F2 */
    test('Monohybrid F2 vg/+ x vg/+ gives 3:1', function () {
      var mum = G.fly('F', { '2': [autosome('2', { vg: 'vg[1]' }), autosome('2', {})] });
      var dad = G.fly('M', { '2': [autosome('2', { vg: 'vg[1]' }), autosome('2', {})] });
      var r = G.cross(mum, dad);
      near(phenP(r, 'vestigial wings'), 0.25, 0.001, 'vestigial fraction');
      near(phenP(r, 'wild type'), 0.75, 0.001, 'wild fraction');
    });

    /* 2. Testcross */
    test('Testcross vg/+ x vg/vg gives 1:1', function () {
      var mum = G.fly('F', { '2': [autosome('2', { vg: 'vg[1]' }), autosome('2', {})] });
      var dad = G.fly('M', { '2': [autosome('2', { vg: 'vg[1]' }), autosome('2', { vg: 'vg[1]' })] });
      var r = G.cross(mum, dad);
      near(phenP(r, 'vestigial wings'), 0.5, 0.001, 'vestigial fraction');
    });

    /* 3. Sex linkage, both directions */
    test('white mother x wild father: red daughters, white sons', function () {
      var mum = G.fly('F', { X: [G.hap('X', { w: 'w[1118]' }), G.hap('X', { w: 'w[1118]' })] });
      var dad = G.fly('M', { X: [G.hap('X', {}), G.yHap()] });
      var cls = P.classes(G.cross(mum, dad));
      var daughters = cls.filter(function (c) { return c.phenotype.sex === 'F'; });
      var sons = cls.filter(function (c) { return c.phenotype.sex === 'M'; });
      if (daughters.length !== 1 || daughters[0].phenotype.label !== 'wild type') throw new Error('daughters not all wild type');
      if (sons.length !== 1 || sons[0].phenotype.label !== 'white eyes') throw new Error('sons not all white');
    });

    test('reciprocal cross: all offspring red-eyed', function () {
      var mum = G.fly('F', { X: [G.hap('X', {}), G.hap('X', {})] });
      var dad = G.fly('M', { X: [G.hap('X', { w: 'w[1118]' }), G.yHap()] });
      var cls = P.classes(G.cross(mum, dad));
      cls.forEach(function (c) {
        if (c.phenotype.label !== 'wild type') throw new Error('unexpected class: ' + c.phenotype.label);
      });
    });

    /* 4. Balancer lethality */
    test('CyO/+ x CyO/+ gives 2 Curly : 1 wild, no CyO/CyO', function () {
      var mum = G.fly('F', { '2': [G.balancerHap('CyO'), autosome('2', {})] });
      var dad = G.fly('M', { '2': [G.balancerHap('CyO'), autosome('2', {})] });
      var r = G.cross(mum, dad);
      near(phenP(r, 'Curly wings'), 2 / 3, 0.001, 'Curly fraction');
      near(phenP(r, 'wild type'), 1 / 3, 0.001, 'wild fraction');
      near(r.lost, 0.25, 0.001, 'fraction of zygotes lost');
      r.classes.forEach(function (c) {
        if (G.genotypeString(c.fly).indexOf('CyO/CyO') >= 0) throw new Error('CyO/CyO survived');
      });
    });

    /* 5 and 6. Recombination */
    test('two-point testcross b-vg recovers ~17.7% recombinants in females', function () {
      var cis = autosome('2', { b: 'b[1]', vg: 'vg[1]' });
      var mum = G.fly('F', { '2': [cis, autosome('2', {})] });
      var dad = G.fly('M', { '2': [G.cloneHap(cis), G.cloneHap(cis)] });
      var r = G.cross(mum, dad);
      var rec = phenP(r, 'black body') + phenP(r, 'vestigial wings');
      near(rec, G.recombFraction(67.0 - 48.5), 0.002, 'recombinant fraction');
      near(rec, 0.177, 0.005, 'recombinant fraction against the map');
    });

    test('same cross through the father gives no recombinants', function () {
      var cis = autosome('2', { b: 'b[1]', vg: 'vg[1]' });
      var dad = G.fly('M', { '2': [cis, autosome('2', {})] });
      var mum = G.fly('F', { '2': [G.cloneHap(cis), G.cloneHap(cis)] });
      var r = G.cross(mum, dad);
      var rec = phenP(r, 'black body') + phenP(r, 'vestigial wings');
      near(rec, 0, 0.0001, 'recombinant fraction in males');
    });

    /* 7. Three-point cross recovers gene order */
    test('three-point y-sn-f: rarest gametes are the double crossovers', function () {
      var triple = G.hap('X', { y: 'y[1]', sn: 'sn[3]', f: 'f[1]' });
      var mum = G.fly('F', { X: [triple, G.hap('X', {})] });
      var gs = G.enumerateGametes(mum, 'X').slice().sort(function (a, b) { return a.p - b.p; });
      var rarest = gs.slice(0, 2).map(function (gm) { return Object.keys(gm.hap.alleles).sort().join(','); }).sort();
      var want = ['f,y', 'sn'];
      if (rarest.join(' | ') !== want.join(' | ')) {
        throw new Error('rarest gametes were ' + rarest.join(' | ') + ', expected ' + want.join(' | '));
      }
    });

    /* 8. Independent assortment across chromosomes */
    test('dihybrid vg (chr 2) x e (chr 3) F2 gives 9:3:3:1', function () {
      var f1 = function (sex) {
        return G.fly(sex, {
          '2': [autosome('2', { vg: 'vg[1]' }), autosome('2', {})],
          '3': [autosome('3', { e: 'e[1]' }), autosome('3', {})]
        });
      };
      var r = G.cross(f1('F'), f1('M'));
      near(phenP(r, 'wild type'), 9 / 16, 0.002, 'wild');
      near(phenP(r, 'vestigial wings'), 3 / 16, 0.002, 'vestigial only');
      near(phenP(r, 'ebony body'), 3 / 16, 0.002, 'ebony only');
      near(phenP(r, 'ebony body, vestigial wings'), 1 / 16, 0.002, 'both');
    });

    /* 9. Sampling matches the exact distribution */
    test('a seeded sample of 4000 tracks the 3:1', function () {
      var mum = G.fly('F', { '2': [autosome('2', { vg: 'vg[1]' }), autosome('2', {})] });
      var dad = G.fly('M', { '2': [autosome('2', { vg: 'vg[1]' }), autosome('2', {})] });
      var r = G.cross(mum, dad);
      var flies = G.sample(r, 4000, 12345);
      var vg = flies.filter(function (x) { return P.of(x.fly).traits.wingSize === 'vestigial'; }).length;
      near(vg / 4000, 0.25, 0.02, 'sampled vestigial fraction');
    });

    /* 10. Parser round trip */
    test('parser reads w; vg/CyO; se/+', function () {
      var out = FCS.parse.parse('w; vg/CyO; se/+', 'F');
      if (!out.ok) throw new Error('unparsed tokens: ' + out.unknown.join(', '));
      var s = G.genotypeString(out.fly);
      if (s !== 'w/w; vg/CyO; se/+') throw new Error('round trip gave ' + s);
    });

    test('parser gives a male a Y', function () {
      var out = FCS.parse.parse('y,w; +; TM3,Sb/+', 'M');
      if (!out.ok) throw new Error('unparsed tokens: ' + out.unknown.join(', '));
      var s = G.genotypeString(out.fly);
      if (s.indexOf('/Y') < 0) throw new Error('no Y in ' + s);
      if (s.indexOf('y,w/Y') !== 0) throw new Error('X not read in cis: ' + s);
    });

    test('an unknown allele becomes an invisible marker, not an error', function () {
      var out = FCS.parse.parse('w; Sas-6[c02901]/CyO', 'F');
      if (!out.ok) throw new Error('should have accepted it: ' + out.unknown.join(', '));
      if (out.newMarkers.join() !== 'Sas-6[c02901]') throw new Error('newMarkers was ' + JSON.stringify(out.newMarkers));
      var s = G.genotypeString(out.fly);
      if (s !== 'w/w; Sas-6[c02901]/CyO; +/+') throw new Error('got ' + s);
      var ph = P.of(out.fly);
      if (ph.label !== 'white eyes, Curly wings') throw new Error('unexpected phenotype: ' + ph.label);
      var shown = ph.expressed.filter(function (e) { return e.allele.unknown; });
      if (shown.length) throw new Error('an unknown allele must stay invisible, but ' + shown[0].allele.symbol + ' showed');
    });

    test('a balancer in the segment settles the chromosome for its partner', function () {
      var out = FCS.parse.parse('cnn[f04547]/TM6B', 'F');
      if (FCS.data.genes['u:cnn[f04547]'].chr !== '3') throw new Error('cnn was put on ' + FCS.data.genes['u:cnn[f04547]'].chr);
      if (G.genotypeString(out.fly) !== '+/+; +/+; cnn[f04547]/TM6B') throw new Error('got ' + G.genotypeString(out.fly));
    });

    test('a real double-balanced stock crosses to the right ratios', function () {
      var mum = FCS.parse.parse('w; Sas-6[c02901]/CyO; cnn[f04547]/TM6B', 'F').fly;
      var dad = FCS.parse.parse('w; Sas-6[c02901]/CyO; cnn[f04547]/TM6B', 'M').fly;
      var r = G.cross(mum, dad);
      near(r.lost, 1 - (3 / 4) * (3 / 4), 0.001, 'fraction of zygotes lost to the two balancers');
      var dbl = r.classes.filter(function (c) {
        var s = G.genotypeString(c.fly);
        return s.indexOf('Sas-6[c02901]/Sas-6[c02901]') >= 0 && s.indexOf('cnn[f04547]/cnn[f04547]') >= 0;
      }).reduce(function (t, c) { return t + c.p; }, 0);
      near(dbl, (1 / 3) * (1 / 3), 0.002, 'double homozygotes among survivors');
    });

    test('an unmapped allele stops recombination being invented', function () {
      var hap = G.hap('2', { 'u:foo': FCS.data.ensureAllele('foo', '2'), vg: 'vg[1]' }, null);
      var mum = G.fly('F', { '2': [hap, G.hap('2', {}, null)] });
      var dad = G.fly('M', { '2': [G.cloneHap(hap), G.cloneHap(hap)] });
      var r = G.cross(mum, dad);
      if (!r.notes.length) throw new Error('expected a note about the missing map distance');
      var gs = G.enumerateGametes(mum, '2');
      if (gs.length !== 2) throw new Error('expected parental gametes only, got ' + gs.length);
    });

    test('parser tells b (black) from B (Bar)', function () {
      var black = FCS.parse.parse('b', 'F');
      var bar = FCS.parse.parse('B', 'F');
      if (G.genotypeString(black.fly) !== '+/+; b/b; +/+') throw new Error('b gave ' + G.genotypeString(black.fly));
      if (G.genotypeString(bar.fly) !== 'B/B; +/+; +/+') throw new Error('B gave ' + G.genotypeString(bar.fly));
    });

    test('an allele lands on its own chromosome, not its position', function () {
      var out = FCS.parse.parse('vg', 'M');
      if (G.genotypeString(out.fly) !== '+/Y; vg/vg; +/+') throw new Error('got ' + G.genotypeString(out.fly));
    });

    test('a segment mixing two chromosomes is refused', function () {
      var out = FCS.parse.parse('w,vg', 'F');
      if (out.ok) throw new Error('should have refused w,vg');
    });

    test('balancer spelling is forgiving but alleles are not', function () {
      var out = FCS.parse.parse('cyo/+', 'F');
      /* and it is written back the way it is written at the bench, with the
         balancer after the slash whichever side it was typed on */
      if (G.genotypeString(out.fly) !== '+/+; +/CyO; +/+') throw new Error('got ' + G.genotypeString(out.fly));
    });

    /* Display only, but it is the thing you scan a vial for: which half of the
     slash is the gene you are pushing, and which half is scaffolding. */
  test('the app can tell your gene from the markers it ships with', function () {
    function sides(text) {
      var f = FCS.parse.parse(text, 'F').fly;
      var out = {};
      G.genotypeParts(f).forEach(function (part) {
        part.sides.forEach(function (side) { out[side.text] = side.yours; });
      });
      return out;
    }
    var a = sides('+; ownGene/CyO; +');
    if (a.ownGene !== true) throw new Error('a gene of your own should stand out');
    if (a.CyO !== false) throw new Error('a balancer should not');
    var b = sides('+; Gla/If; Dr/TM6C');
    ['Gla', 'If', 'Dr', 'TM6C'].forEach(function (name) {
      if (b[name] !== false) throw new Error(name + ' ships with the app and should stay quiet');
    });
    if (b['+'] !== false) throw new Error('wild type is nobody\'s gene');
    /* The same call, made from written text rather than from a live fly. */
    if (!FCS.parse.isYourSide('ownGene')) throw new Error('unknown names are yours');
    ['TM6C', 'MKRS', 'Gla', 'Pr', 'Dr', '+', 'Y', 'TM3,Sb'].forEach(function (name) {
      if (FCS.parse.isYourSide(name)) throw new Error(name + ' is standard');
    });
  });

  test('a balancer is always written second', function () {
      function geno(text, sex) { return G.genotypeString(FCS.parse.parse(text, sex || 'F').fly); }
      if (geno('+; +; TM6C/myGene').indexOf('myGene/TM6C') < 0) throw new Error('TM6C should follow the gene');
      /* written in the second slot or the third, MKRS is a chromosome 3
         chromosome and the gene still comes first */
      if (geno('+; MKRS/myGene; +') !== '+/+; +/+; myGene/MKRS') {
        throw new Error('got ' + geno('+; MKRS/myGene; +'));
      }
      /* two balancers keep the order they were written in: neither is the gene */
      if (geno('+; +; TM3,Sb/TM6B').indexOf('TM3,Sb/TM6B') < 0) throw new Error('two balancers keep their order');
      /* and the X still leads its Y */
      if (geno('w/B[S]Y', 'M').indexOf('w/B[S]Y') < 0) throw new Error('the X comes first');
    });

    /* ---- balancers suppress recombination; that is what makes them balancers ---- */

    test('a marker on a balancer can never be separated from it', function () {
      var marked = FCS.parse.parse('b,vg/+', 'F').fly;
      var balanced = FCS.parse.parse('b,vg/CyO', 'F').fly;
      var free = G.enumerateGametes(marked, '2');
      var held = G.enumerateGametes(balanced, '2');
      if (free.length !== 4) throw new Error('expected 4 gamete classes without a balancer, got ' + free.length);
      if (held.length !== 2) throw new Error('expected parental gametes only over CyO, got ' + held.length);
      var names = held.map(function (gm) { return G.hapString(gm.hap); }).sort().join(' ');
      if (names !== 'CyO b,vg') throw new Error('gametes were ' + names);
    });

    test('MKRS is marked, not balanced, so its markers can come off', function () {
      var over = FCS.parse.parse('e/MKRS', 'F').fly;
      var gs = G.enumerateGametes(over, '3');
      if (gs.length <= 2) throw new Error('MKRS should recombine, got ' + gs.length + ' gamete classes');
      var intact = gs.filter(function (gm) { return gm.hap.balancer === 'MKRS'; });
      if (!intact.length) throw new Error('an unchanged gamete should still be called MKRS');
      var recombinant = gs.filter(function (gm) { return !gm.hap.balancer && Object.keys(gm.hap.alleles).length; });
      if (!recombinant.length) throw new Error('a recombinant should lose the MKRS name');
    });

    test('MKRS over TM6B is balanced by the TM6B', function () {
      var f = FCS.parse.parse('MKRS/TM6B', 'F').fly;
      if (G.enumerateGametes(f, '3').length !== 2) throw new Error('TM6B should suppress');
    });

    test('the panel calls a balancer marker carried, not mapped', function () {
      var f = FCS.parse.parse('CyO/+', 'F').fly;
      var cy = P.of(f).expressed.filter(function (e) { return e.allele.symbol === 'Cy'; })[0];
      if (!cy) throw new Error('Cy was not expressed');
      if (cy.onBalancer !== 'CyO') throw new Error('Cy should be marked as carried on CyO, got ' + cy.onBalancer);
    });

    /* ---------------- the planner ---------------- */

    var PL = FCS.planner;

    function miniPool(list) {
      return list.map(function (row) {
        var f = FCS.parse.parse(row[1], 'F');
        return { name: row[0], genotype: row[1], source: row[2] || 'held',
          note: '', fly: f.fly, key: PL.key(f.fly) };
      });
    }

    test('the planner says when you already have the fly', function () {
      var pool = miniPool([['S1', 'w; vg/CyO'], ['S2', 'w; +; e/TM6B']]);
      var want = FCS.parse.parse('w; vg/CyO', 'F');
      var r = PL.plan(want.fly, { pool: pool, constrain: want.specified });
      if (!r.ok || !r.already) throw new Error('should have found it in the pool');
      if (r.already.name !== 'S1') throw new Error('found ' + r.already.name);
    });

    test('the planner selfs a balanced stock to get the homozygote', function () {
      var pool = miniPool([['S1', 'w; vg/CyO']]);
      var want = FCS.parse.parse('vg/vg', 'F');
      var r = PL.plan(want.fly, { pool: pool, constrain: want.specified });
      if (!r.ok) throw new Error(r.reason);
      if (r.steps.length !== 1) throw new Error('expected one cross, got ' + r.steps.length);
      var w = r.steps[0].wanted;
      /* Fractions are per sex, because that is how you sort: the vestigial
         females are a sixth of the vial and the males another sixth. */
      near(w.fraction, 1 / 6, 0.01, 'fraction of the vial');
      if (w.ambiguous) throw new Error('this one should be unambiguous');
      if (w.label.indexOf('vestigial') < 0) throw new Error('selected on ' + w.label);
    });

    test('every step of a scheme reproduces when the cross is run again', function () {
      var pool = miniPool([['S1', 'w; vg/CyO'], ['S2', 'w; +; e/TM6B'], ['T1', 'w; If/CyO; MKRS/TM6B', 'tool']]);
      var want = FCS.parse.parse('vg/CyO; e/TM6B', 'F');
      var r = PL.plan(want.fly, { pool: pool, constrain: want.specified });
      if (!r.ok) throw new Error(r.reason);
      r.steps.forEach(function (st, i) {
        var res = G.cross(st.mother.fly, st.father.fly);
        var cls = P.classes(res).filter(function (c) { return c.phenotype.label === st.wanted.label
          && c.phenotype.sex === st.wanted.sex; })[0];
        if (!cls) throw new Error('step ' + (i + 1) + ': the class it asks for does not appear');
        near(cls.p, st.wanted.fraction, 0.001, 'step ' + (i + 1) + ' fraction');
        var found = cls.genotypes.filter(function (g) { return PL.key(g.fly) === st.wanted.key; });
        if (!found.length) throw new Error('step ' + (i + 1) + ': the wanted genotype is not in that class');
      });
      var last = r.steps[r.steps.length - 1];
      if (!PL.reached(last.wanted.fly, want.fly, want.specified)) throw new Error('the last step does not reach the target');
    });

    test('the planner names what no stock carries', function () {
      var pool = miniPool([['S1', 'w; vg/CyO']]);
      var want = FCS.parse.parse('w; +; NoSuchThing/TM6B', 'F');
      var r = PL.plan(want.fly, { pool: pool, constrain: want.specified });
      if (r.ok) throw new Error('should not have found a scheme');
      if (r.reason.indexOf('NoSuchThing') < 0) throw new Error('reason did not name it: ' + r.reason);
    });

    test('chromosomes you did not ask about are left alone', function () {
      var pool = miniPool([['S1', 'w; vg/CyO; e/TM6B']]);
      var want = FCS.parse.parse('vg/vg', 'F');
      var r = PL.plan(want.fly, { pool: pool, constrain: want.specified });
      if (!r.ok) throw new Error(r.reason);
      if (r.steps.length > 1) throw new Error('should not have tried to clean up chromosome 3');
    });

    test('working back one generation gives the canonical pair of parents', function () {
      var want = FCS.parse.parse('+; geneAA/geneBB; geneCC/geneDD', 'F');
      var d = PL.deriveOneGeneration(want.fly, want.specified);
      if (!d.ok) throw new Error(d.reason);
      if (d.constrain.join(',') !== '2,3') throw new Error('constrained ' + d.constrain.join(','));
      var mum = G.genotypeString(d.mother), dad = G.genotypeString(d.father);
      if (mum !== '+/+; geneAA/CyO; geneCC/TM6B') throw new Error('mother was ' + mum);
      if (dad !== '+/Y; geneBB/CyO; geneDD/TM6B') throw new Error('father was ' + dad);
      if (d.amongN !== 1) throw new Error('the class it picks should be unique, got ' + d.amongN);
      if (d.label !== 'wild type') throw new Error('should select the unmarked class, got ' + d.label);
      near(d.fraction, 1 / 18, 0.002, 'fraction of the vial');
    });

    test('the derived cross really does give the target', function () {
      var want = FCS.parse.parse('+; vg/vg; e/e', 'F');
      var d = PL.deriveOneGeneration(want.fly, want.specified);
      if (!d.ok) throw new Error(d.reason);
      var res = G.cross(d.mother, d.father);
      var cls = P.classes(res).filter(function (c) {
        return c.phenotype.label === d.label && c.phenotype.sex === d.sex;
      })[0];
      if (!cls) throw new Error('the class it names does not appear');
      near(cls.p, d.fraction, 0.001, 'fraction');
      var hit = cls.genotypes.filter(function (g) { return PL.reached(g.fly, want.fly, want.specified); });
      if (!hit.length) throw new Error('the target is not in that class');
    });

    test('it never balances a chromosome the target says nothing about', function () {
      var want = FCS.parse.parse('+; vg/vg', 'F');
      var d = PL.deriveOneGeneration(want.fly, want.specified);
      if (!d.ok) throw new Error(d.reason);
      ['X', '3', '4'].forEach(function (id) {
        [0, 1].forEach(function (i) {
          if (d.mother.chrs[id][i].balancer) throw new Error('balanced chromosome ' + id + ' for no reason');
        });
      });
    });

    /* ---------- a stock list of your own ---------- */

    var SRC = FCS.stockSource;

    test('a stock list with headers is read by its column names', function () {
      var csv = 'Stock #,Genotype,Notes,In stock\n'
        + 'JR1,"w; cnn[f04547]/CyO",old vial,yes\n'
        + 'JR2,w; Sas-6/TM6B,,no\n';
      var r = SRC.parseFile(csv, 'mine.csv');
      if (r.rows.length !== 2) throw new Error('read ' + r.rows.length + ' rows');
      if (r.rows[0].n !== 'JR1') throw new Error('stock number was ' + r.rows[0].n);
      if (r.rows[0].g !== 'w; cnn[f04547]/CyO') throw new Error('genotype was ' + r.rows[0].g);
      if (r.rows[0].s !== 1 || r.rows[1].s !== 0) throw new Error('in-stock column not read');
    });

    test('a headerless list finds the genotype column by its shape', function () {
      var tsv = 'A1\tw; vg/CyO\tkeep\nA2\tw; e/TM6B\tkeep\n';
      var r = SRC.parseFile(tsv, 'mine.tsv');
      if (r.rows.length !== 2) throw new Error('read ' + r.rows.length + ' rows');
      if (r.rows[0].g !== 'w; vg/CyO') throw new Error('genotype was ' + r.rows[0].g);
      if (r.rows[0].n !== 'A1') throw new Error('stock number was ' + r.rows[0].n);
      if (r.rows[0].s !== 1) throw new Error('with no in-stock column every row counts as held');
    });

    test('a list with no genotype anywhere is refused rather than guessed at', function () {
      var bad = false;
      try { SRC.parseFile('name,project\nAlice,cnn\n', 'no.csv'); }
      catch (e) { bad = true; }
      if (!bad) throw new Error('it should say it cannot find a genotype column');
    });

    test('a JSON export is read too', function () {
      var r = SRC.parseFile('[{"Stock":"7","Genotype":"w; vg/CyO","In stock":"y"}]', 'mine.json');
      if (r.rows.length !== 1 || r.rows[0].g !== 'w; vg/CyO') throw new Error('JSON not read');
      if (r.rows[0].s !== 1) throw new Error('in stock not read');
    });

    test('an allele nobody has heard of works on the chromosome you put it on', function () {
      FCS.data.ensureAllele('myThing-GFP', '3');
      var f = FCS.parse.parse('+; +; myThing-GFP/TM6B', 'F');
      if (!f.ok) throw new Error('could not read it back');
      var gene = FCS.data.genes[FCS.data.alleles['myThing-GFP'].gene];
      if (gene.chr !== '3') throw new Error('it landed on chromosome ' + gene.chr);
      if (f.fly.chrs['3'][0].alleles[gene.id] !== 'myThing-GFP') throw new Error('not carried on 3');
      var ph = P.of(f.fly);
      if (ph.label.indexOf('myThing') >= 0) throw new Error('an untagged allele should be invisible');
    });

    /* ---------- map positions entered by hand ---------- */

    test('a map position entered by hand turns recombination on', function () {
      FCS.data.ensureAllele('myA', '2');
      FCS.data.ensureAllele('myB', '2');
      var gA = FCS.data.alleles.myA.gene, gB = FCS.data.alleles.myB.gene;
      FCS.data.setGenePosition(gA, null);
      FCS.data.setGenePosition(gB, null);

      var mum = FCS.parse.parse('+; myA,myB/+', 'F').fly;
      var before = G.linkage(mum);
      if (!before.length || before[0].kind !== 'missing') throw new Error('should start unmapped');
      var flat = G.enumerateGametes(mum, '2');
      if (flat.length !== 2) throw new Error('unmapped should give parental gametes only, got ' + flat.length);

      FCS.data.setGenePosition(gA, 10);
      FCS.data.setGenePosition(gB, 30);
      var after = G.linkage(mum);
      if (after[0].kind !== 'recombining') throw new Error('should recombine once both are mapped');
      near(after[0].steps[0].cM, 20, 0.001, 'distance');
      near(after[0].steps[0].r, 0.5 * Math.tanh(20 / 50), 0.0001, 'Kosambi fraction');

      var gam = G.enumerateGametes(mum, '2');
      var single = gam.filter(function (x) {
        var ks = Object.keys(x.hap.alleles);
        return ks.length === 1 && x.hap.alleles[gA] === 'myA';
      })[0];
      if (!single) throw new Error('no recombinant carrying myA alone');
      near(single.p, 0.5 * after[0].steps[0].r, 0.0001, 'recombinant frequency');

      FCS.data.setGenePosition(gA, null);
      FCS.data.setGenePosition(gB, null);
    });

    test('a position marked as an estimate is reported as one', function () {
      FCS.data.ensureAllele('myC', '3');
      FCS.data.ensureAllele('myD', '3');
      var gC = FCS.data.alleles.myC.gene, gD = FCS.data.alleles.myD.gene;
      FCS.data.setGenePosition(gC, 40, { approx: true });
      FCS.data.setGenePosition(gD, 60);
      var e = G.linkage(FCS.parse.parse('+; +; myC,myD/+', 'F').fly)[0];
      if (!e.approx) throw new Error('the estimate should be carried through to the note');
      if (e.text.indexOf('approximate') < 0) throw new Error('the note should say so: ' + e.text);
      FCS.data.setGenePosition(gC, null);
      FCS.data.setGenePosition(gD, null);
    });

    test('a balancer still suppresses however well mapped the genes are', function () {
      FCS.data.ensureAllele('myE', '2');
      FCS.data.ensureAllele('myF', '2');
      var gE = FCS.data.alleles.myE.gene, gF = FCS.data.alleles.myF.gene;
      FCS.data.setGenePosition(gE, 5);
      FCS.data.setGenePosition(gF, 75);
      var mum = FCS.parse.parse('+; myE,myF/CyO', 'F').fly;
      if (G.linkage(mum).length) throw new Error('a balanced chromosome has nothing to report');
      var gam = G.enumerateGametes(mum, '2');
      if (gam.length !== 2) throw new Error('CyO should give two gametes, got ' + gam.length);
      FCS.data.setGenePosition(gE, null);
      FCS.data.setGenePosition(gF, null);
    });

    test('a balancer marker written loose does not recombine', function () {
      /* Cy/+ means a CyO chromosome written in a hurry, not a free marker at
         6.1 cM. b is at 48.5, so a careless engine would give 20% recombinants. */
      var mum = FCS.parse.parse('+; Cy,b/+', 'F').fly;
      var gam = G.enumerateGametes(mum, '2');
      if (gam.length !== 2) throw new Error('should give two parental gametes, got ' + gam.length);
      var e = G.linkage(mum)[0];
      if (!e || e.kind !== 'balancer-marker') throw new Error('should say why it did not recombine');
      if (e.text.indexOf('CyO') < 0) throw new Error('the note should point at the balancer: ' + e.text);
    });

    test('but MKRS, which has no inversions, still lets Sb come off', function () {
      var gam = G.enumerateGametes(FCS.parse.parse('+; +; MKRS,e/+', 'F').fly, '3');
      if (gam.length <= 2) throw new Error('MKRS should recombine, got ' + gam.length + ' gamete classes');
    });

    /* ---------- the crossing scheme ---------- */

    test('a scheme reads back the crosses in order, with what you kept', function () {
      var vials = [
        { id: 'v1', name: 'w; Sco/CyO', meta: { kind: 'stock', genotype: 'w; Sco/CyO' } },
        { id: 'v2', name: 'w; myGene/+', meta: { kind: 'stock', genotype: 'w; myGene/+' } },
        { id: 'v3', name: 'Cross 1', meta: {
          kind: 'cross', motherText: 'w/w; myGene/+', fatherText: 'w/Y; Sco/CyO',
          from: { mother: { vialId: 'v2', fromName: 'w; myGene/+', label: 'white eyes', sex: 'F', p: null },
                  father: { vialId: 'v1', fromName: 'w; Sco/CyO', label: 'Curly wings', sex: 'M', p: null } },
          result: { notes: [] },
          classes: [{ label: 'white eyes, Curly wings', sex: 'F', p: 0.25 }]
        } },
        { id: 'v4', name: 'Cross 2', meta: {
          kind: 'cross', motherText: 'w/w; myGene/CyO', fatherText: 'w/Y; myGene/CyO',
          from: { mother: { vialId: 'v3', fromName: 'Cross 1', label: 'white eyes, Curly wings', sex: 'F', p: 0.25 },
                  father: { vialId: 'v3', fromName: 'Cross 1', label: 'white eyes, Curly wings', sex: 'M', p: 0.25 } },
          result: { notes: ['Chromosome 2 is recombining in the mother: a-b 10 cM'] },
          classes: [{ label: 'white eyes', sex: 'F', p: 1 / 3 }]
        } }
      ];

      var list = FCS.scheme.steps('v4', vials);
      if (list.length !== 2) throw new Error('expected two crosses, got ' + list.length);
      if (list[0].name !== 'Cross 1') throw new Error('ancestors should come first');
      if (list[0].kept.length !== 2) throw new Error('both parents of Cross 2 came from Cross 1');
      near(list[0].kept[0].p, 0.25, 0.0001, 'what you kept out of Cross 1');

      var md = FCS.scheme.toMarkdown('v4', vials, {});
      if (md.indexOf('## Step 1') < 0 || md.indexOf('## Step 2') < 0) throw new Error('steps missing');
      if (md.indexOf('25.0% of the vial, about 1 in 4') < 0) throw new Error('frequency missing: ' + md);
      if (md.indexOf('virgin females') < 0) throw new Error('should say which sex to collect');
      if (md.indexOf('recombining') < 0) throw new Error('the map note should travel with the step');
    });

    test('a stock vial has no scheme, and says so rather than breaking', function () {
      var vials = [{ id: 'v1', name: 'w', meta: { kind: 'stock', genotype: 'w' } }];
      if (FCS.scheme.steps('v1', vials).length) throw new Error('a stock is not a cross');
      if (FCS.scheme.toMarkdown('v1', vials, {}).indexOf('Nothing has been crossed') < 0) {
        throw new Error('should say the vial has no crosses behind it');
      }
    });

    /* ---------- saving the bench, and a branching scheme ---------- */

    test('a bench packs and comes back with its flies, selection and crosses', function () {
      FCS.data.ensureAllele('myKeeper', '2');
      var mum = FCS.parse.parse('w; myKeeper/CyO', 'F').fly;
      var dad = FCS.parse.parse('w; myKeeper/CyO', 'M').fly;
      var res = G.cross(mum, dad);
      var state = {
        nextId: 9, sampleSize: 100, activeId: 'v2',
        vials: [
          { id: 'v1', name: 'stock', meta: { kind: 'stock', genotype: 'w; myKeeper/CyO' },
            items: [{ fly: mum, selected: true }, { fly: mum, selected: false }, { fly: dad, selected: false }] },
          { id: 'v2', name: 'Cross 1', meta: {
            kind: 'cross', result: res, motherFly: mum, fatherFly: dad,
            motherText: G.genotypeString(mum), fatherText: G.genotypeString(dad),
            from: { mother: null, father: null }, classes: [] },
            items: [{ fly: mum, selected: false }] }
        ]
      };

      var data = JSON.parse(JSON.stringify(FCS.bench.pack(state)));
      if (data.vials[0].flies.length !== 2) throw new Error('identical flies should be stored once');
      if (data.vials[0].refs.length !== 3) throw new Error('every fly needs a reference');
      if (data.vials[1].meta.result) throw new Error('the cross result should not be stored');
      if (!data.genes.some(function (g) { return g.symbol === 'myKeeper'; })) {
        throw new Error('genes of your own have to travel with the bench');
      }

      var back = FCS.bench.unpack(data);
      if (back.vials[0].items.length !== 3) throw new Error('lost flies on the way back');
      if (!back.vials[0].items[0].selected) throw new Error('the selection should survive');
      if (G.genotypeString(back.vials[0].items[0].fly) !== G.genotypeString(mum)) throw new Error('genotype changed');
      /* The result is deliberately NOT rebuilt while the file opens - the
         parents are enough, and the bench works it out when the vial is looked
         at. What has to survive is the pair of parents. */
      if (back.vials[1].meta.result) throw new Error('the result should not be rebuilt on opening');
      var again = G.cross(back.vials[1].meta.motherFly, back.vials[1].meta.fatherFly);
      near(again.classes.length, res.classes.length, 0, 'the saved parents give the same cross');
    });

    test('a file that is not a bench is refused rather than half-loaded', function () {
      var bad = false;
      try { FCS.bench.unpack({ hello: 'world' }); } catch (e) { bad = true; }
      if (!bad) throw new Error('should refuse a foreign file');
    });

    test('a branching scheme numbers its steps and draws them', function () {
      var vials = [
        { id: 'a', name: 'Cross A', meta: { kind: 'cross', motherText: 'w/w; x/CyO', fatherText: 'w/Y; x/CyO',
          from: {}, classes: [], result: { notes: [] } } },
        { id: 'b', name: 'Cross B', meta: { kind: 'cross', motherText: 'w/w; y/TM6B', fatherText: 'w/Y; y/TM6B',
          from: {}, classes: [], result: { notes: [] } } },
        { id: 'c', name: 'Cross C', meta: { kind: 'cross', motherText: 'w/w; x/CyO', fatherText: 'w/Y; y/TM6B',
          from: { mother: { vialId: 'a', fromName: 'Cross A', label: 'Curly', sex: 'F', p: 0.5 },
                  father: { vialId: 'b', fromName: 'Cross B', label: 'Tubby', sex: 'M', p: 0.5 } },
          classes: [], result: { notes: [] } } }
      ];
      var list = FCS.scheme.steps('c', vials);
      if (list.length !== 3) throw new Error('two feeder crosses plus the last one');
      if (list[2].mother.from.step !== 1 || list[2].father.from.step !== 2) {
        throw new Error('the last step should point back at steps 1 and 2');
      }
      var md = FCS.scheme.toMarkdown('c', vials, {});
      if (md.indexOf('from step 1 (Cross A)') < 0) throw new Error('step cross-reference missing: ' + md);
      var chart = FCS.scheme.toMermaid(list);
      if (chart.indexOf('S1 -->') < 0 || chart.indexOf('S2 -->') < 0) throw new Error('both feeders should be drawn');
      if (chart.indexOf('flowchart TD') < 0) throw new Error('not a mermaid block');
    });

    test('two different balancers over each other are viable; two of the same are not', function () {
      /* Each balancer carries its own recessive lethal, so a second copy of the
         same one kills. Different ones cover each other, which is why
         TM3,Sb/TM6B and MKRS/TM6B are stocks you can keep. */
      function alive(text) {
        var f = FCS.parse.parse(text, 'F');
        if (!f.ok) throw new Error('could not read ' + text);
        return G.viability(f.fly).alive;
      }
      if (!alive('+; +; TM3,Sb/TM6B')) throw new Error('TM3,Sb/TM6B should live');
      if (!alive('+; +; MKRS/TM6B')) throw new Error('MKRS/TM6B should live');
      if (!alive('+; Gla/CyO')) throw new Error('Gla/CyO should live');
      if (!alive('FM7a/FM7a')) throw new Error('FM7a is homozygous viable');
      if (alive('+; CyO/CyO')) throw new Error('CyO/CyO should die');
      if (alive('+; +; TM6B/TM6B')) throw new Error('TM6B/TM6B should die');
      if (alive('+; +; MKRS/MKRS')) throw new Error('MKRS/MKRS should die, through its own Sb');
    });

    test('every stock the app ships with is a fly that can live', function () {
      if (!FCS.stocks) return;                 /* not loaded in this runner */
      FCS.stocks.forEach(function (st) {
        var f = FCS.parse.parse(st.g, 'F');
        if (!f.ok) throw new Error(st.n + ' does not parse: ' + st.g);
        if (!G.viability(f.fly).alive) {
          throw new Error(st.n + ' (' + st.g + ') is dead: ' + G.viability(f.fly).reason);
        }
      });
    });

    test('an allele of your own can be told it is homozygous lethal', function () {
      FCS.data.ensureAllele('myLethal', '2');
      FCS.data.setAlleleProps('myLethal', { lethal: 'none' });
      var homo = FCS.parse.parse('+; myLethal/myLethal', 'F');
      if (!G.viability(homo.fly).alive) throw new Error('it should start harmless');

      FCS.data.setAlleleProps('myLethal', { lethal: 'recessive' });
      if (G.viability(homo.fly).alive) throw new Error('homozygotes should now die');
      var het = FCS.parse.parse('+; myLethal/CyO', 'F');
      if (!G.viability(het.fly).alive) throw new Error('over a balancer it must still live');

      /* and the cross that keeps it: 1/3 of the survivors, never a homozygote */
      var res = G.cross(het.fly, FCS.parse.parse('+; myLethal/CyO', 'M').fly);
      near(res.survival, 0.5, 0.001, 'half the zygotes die');
      var homozygotes = res.classes.filter(function (c) {
        return G.genotypeString(c.fly).indexOf('myLethal/myLethal') >= 0;
      });
      if (homozygotes.length) throw new Error('a homozygote survived');
      FCS.data.setAlleleProps('myLethal', { lethal: 'none' });
    });

    test('a marker on the chromosome is written in cis, not on the allele', function () {
      var out = FCS.alleleProps.withCis('w; cnnf/CyO; +', 'cnnf', 'Sb');
      if (out.indexOf('cnnf,Sb/CyO') < 0) throw new Error('marker went to the wrong side: ' + out);
      var other = FCS.alleleProps.withCis('w; CyO/cnnf', 'cnnf', 'Sp');
      if (other.indexOf('CyO/cnnf,Sp') < 0) throw new Error('should follow the allele: ' + other);
      var missing = FCS.alleleProps.withCis('w; vg/CyO', 'cnnf', 'Sb');
      if (missing !== 'w; vg/CyO') throw new Error('an allele that is not there changes nothing');
    });

    test('a gene of your own can be moved to the right chromosome', function () {
      /* The usual way one lands wrong: written first where nothing said which
         chromosome it belonged to, so it went by its position in the text. */
      var first = FCS.parse.parse('myStray', 'F');
      var geneId = FCS.data.alleles.myStray.gene;
      if (FCS.data.genes[geneId].chr !== 'X') throw new Error('should land on X by position');
      if (!first.ok) throw new Error('it should still read');

      var clash = FCS.parse.parse('myStray/SM5', 'F');
      if (clash.ok) throw new Error('X over a chromosome 2 balancer should be refused');
      if (clash.unknown.join(' ').indexOf('is yours') < 0) {
        throw new Error('the message should say it is one of yours: ' + clash.unknown.join(' '));
      }

      FCS.data.setGenePosition(geneId, 30);
      if (!FCS.data.moveGene(geneId, '2')) throw new Error('should move');
      if (FCS.data.genes[geneId].chr !== '2') throw new Error('did not move');
      if (typeof FCS.data.genes[geneId].pos === 'number') throw new Error('the old position must not follow it');

      var after = FCS.parse.parse('myStray/SM5', 'F');
      if (!after.ok) throw new Error('it should read now: ' + after.unknown.join(' '));
      if (FCS.genetics.genotypeString(after.fly).indexOf('myStray/SM5') < 0) {
        throw new Error('wrong genotype: ' + FCS.genetics.genotypeString(after.fly));
      }
    });

    test('a library gene cannot be moved', function () {
      if (FCS.data.moveGene('vg', '3')) throw new Error('vg is on 2 and that is a fact');
      if (FCS.data.genes.vg.chr !== '2') throw new Error('vg moved anyway');
    });

    test('each cross gets a date, and a branch waits for its slowest arm', function () {
      var vials = [
        { id: 'a', name: 'Cross A', meta: { kind: 'cross', motherText: 'x', fatherText: 'y',
          from: {}, classes: [], result: { notes: [] } } },
        { id: 'b', name: 'Cross B', meta: { kind: 'cross', motherText: 'x', fatherText: 'y',
          from: { mother: { vialId: 'a', fromName: 'Cross A', label: 'Curly', sex: 'F', p: 0.5 } },
          classes: [], result: { notes: [] } } },
        { id: 'c', name: 'Cross C', meta: { kind: 'cross', motherText: 'x', fatherText: 'y',
          from: { mother: { vialId: 'b', fromName: 'Cross B', label: 'Curly', sex: 'F', p: 0.5 },
                  father: { vialId: 'a', fromName: 'Cross A', label: 'Tubby', sex: 'M', p: 0.5 } },
          classes: [], result: { notes: [] } } }
      ];
      var list = FCS.scheme.steps('c', vials, { start: '2026-09-23', days: 14 });
      if (list[0].generation !== 1) throw new Error('the first cross is generation 1');
      if (list[1].generation !== 2) throw new Error('a cross out of it is generation 2');
      if (list[2].generation !== 3) throw new Error('a cross waiting on generation 2 is generation 3');
      if (list[0].date.getMonth() !== 8 || list[0].date.getDate() !== 23) throw new Error('first date wrong');
      if (list[1].date.getDate() !== 7 || list[1].date.getMonth() !== 9) {
        throw new Error('second should be 14 days later, got ' + list[1].dateText);
      }
      if (list[2].date.getDate() !== 21) throw new Error('third should be 28 days later: ' + list[2].dateText);

      var md = FCS.scheme.toMarkdown('c', vials, { start: '2026-09-23', days: 14 });
      if (md.indexOf('set up') < 0) throw new Error('the file should carry the dates');
      if (md.indexOf('3 generations') < 0) throw new Error('and say how long the whole thing takes: ' + md.slice(0, 300));
    });

    test('with no start date the scheme still reads, just undated', function () {
      var vials = [{ id: 'a', name: 'Cross A', meta: { kind: 'cross', motherText: 'x', fatherText: 'y',
        from: {}, classes: [], result: { notes: [] } } }];
      var list = FCS.scheme.steps('a', vials, {});
      if (list[0].date) throw new Error('no start means no date');
      if (list[0].dateText !== '') throw new Error('and nothing to print');
    });

    test('the plan holds every cross on the bench, not one thread', function () {
      var vials = [
        { id: 's1', name: 'stock', meta: { kind: 'stock', genotype: 'w' }, items: [] },
        { id: 'a', name: 'Cross A', meta: { kind: 'cross', motherText: 'x', fatherText: 'y',
          from: {}, classes: [], result: { notes: [] } } },
        { id: 'b', name: 'Cross B', meta: { kind: 'cross', motherText: 'p', fatherText: 'q',
          from: {}, classes: [], result: { notes: [] } } },
        { id: 'c', name: 'Cross C', meta: { kind: 'cross', motherText: 'm', fatherText: 'n',
          from: { mother: { vialId: 'a', fromName: 'Cross A', label: 'Curly', sex: 'F', p: 0.5 } },
          classes: [], result: { notes: [] } } }
      ];
      var opts = { start: '2026-09-23', days: 14 };

      /* One thread shows only its own ancestors - which is why adding an
         unrelated vial used to look like the scheme had vanished. */
      var thread = FCS.scheme.steps('c', vials, opts);
      if (thread.length !== 2) throw new Error('the thread to C is A then C');

      var all = FCS.scheme.plan(vials, opts);
      if (all.length !== 3) throw new Error('the plan holds all three crosses, got ' + all.length);

      /* Two schemes side by side start together; a cross waiting on one of them
         follows it. */
      var byName = {};
      all.forEach(function (st) { byName[st.name] = st; });
      if (byName['Cross A'].dateValue !== '2026-09-23') throw new Error('A starts on the start date');
      if (byName['Cross B'].dateValue !== '2026-09-23') throw new Error('B runs in parallel, same day');
      if (byName['Cross C'].dateValue !== '2026-10-07') throw new Error('C follows A: ' + byName['Cross C'].dateValue);
    });

    test('pinning one cross to a day moves what waits on it', function () {
      var vials = [
        { id: 'a', name: 'Cross A', meta: { kind: 'cross', motherText: 'x', fatherText: 'y',
          from: {}, classes: [], result: { notes: [] } } },
        { id: 'c', name: 'Cross C', meta: { kind: 'cross', motherText: 'm', fatherText: 'n',
          from: { mother: { vialId: 'a', fromName: 'Cross A', label: 'Curly', sex: 'F', p: 0.5 } },
          classes: [], result: { notes: [] } } }
      ];
      var opts = { start: '2026-09-23', days: 14 };
      vials[0].meta.setUpOn = '2026-11-02';           /* the parental line needed expanding first */
      var all = FCS.scheme.plan(vials, opts);
      var c = all.filter(function (st) { return st.name === 'Cross C'; })[0];
      if (all[0].dateValue !== '2026-11-02') throw new Error('the pinned date should stand');
      if (!all[0].fixed) throw new Error('and be marked as pinned');
      if (c.dateValue !== '2026-11-16') throw new Error('C should follow it: ' + c.dateValue);
    });

    /* ---------- the fourth chromosome, attached X, and a marked Y ---------- */

    test('chromosome 4 markers score, and never recombine', function () {
      var f = FCS.parse.parse('+; +; +; ci[D]/spa[pol]', 'F');
      if (!f.ok) throw new Error('could not read it: ' + f.unknown.join('; '));
      var ph = P.of(f.fly);
      if (ph.label.indexOf('broken wing vein') < 0) throw new Error('ci[D] is dominant: ' + ph.label);
      if (ph.label.indexOf('sparkling') >= 0) throw new Error('spa[pol] is recessive and should be hidden');

      var gam = G.enumerateGametes(f.fly, '4');
      if (gam.length !== 2) throw new Error('the fourth does not recombine, got ' + gam.length + ' gametes');

      var homo = FCS.parse.parse('+; +; +; spa[pol]/spa[pol]', 'F');
      if (P.of(homo.fly).label.indexOf('sparkling eyes') < 0) throw new Error('homozygotes should show it');
    });

    test('a marked Y is still a Y, and its marker shows', function () {
      var m = FCS.parse.parse('w/B[S]Y', 'M');
      if (!m.ok) throw new Error('could not read B[S]Y');
      if (G.genotypeString(m.fly).indexOf('w/B[S]Y') < 0) throw new Error('should print as itself');
      var ph = P.of(m.fly);
      if (ph.label.indexOf('Bar eyes') < 0) throw new Error('the Y marker should show: ' + ph.label);
      if (ph.label.indexOf('white eyes') < 0) throw new Error('and his X should still be read');
      var gam = G.enumerateGametes(m.fly, 'X');
      if (gam.length !== 2) throw new Error('X and Y, nothing else');
    });

    test('attached-X: daughters take their mother, sons their father', function () {
      var mum = FCS.parse.parse('C(1)DX,y,f/Y', 'F');
      var dad = FCS.parse.parse('y,w/Y', 'M');
      if (!mum.ok || !dad.ok) throw new Error('could not read the parents');

      var res = G.cross(mum.fly, dad.fly);
      near(res.survival, 0.5, 0.001, 'half the zygotes die');
      if (res.classes.length !== 2) throw new Error('two classes live, got ' + res.classes.length);

      var daughters = res.classes.filter(function (c) { return c.fly.sex === 'F'; })[0];
      var sons = res.classes.filter(function (c) { return c.fly.sex === 'M'; })[0];
      if (!daughters || !sons) throw new Error('one of each');
      near(daughters.p, 0.5, 0.001, 'half the survivors are daughters');
      if (G.genotypeString(daughters.fly).indexOf('C(1)DX/Y') < 0) {
        throw new Error('daughters carry their mother\'s pair: ' + G.genotypeString(daughters.fly));
      }
      if (G.genotypeString(sons.fly).indexOf('y,w/Y') < 0) {
        throw new Error('sons carry their father\'s X: ' + G.genotypeString(sons.fly));
      }
      var ph = P.of(sons.fly);
      if (ph.label.indexOf('white eyes') < 0) {
        throw new Error('a son shows what his father carried: ' + ph.label);
      }
      var reasons = res.dead.map(function (d) { return d.reason; }).join(' | ');
      if (reasons.indexOf('no X chromosome') < 0 || reasons.indexOf('doses of the X') < 0) {
        throw new Error('the dead should be Y/Y and the metafemales: ' + reasons);
      }
    });

    test('sex follows the dose of the X, not which parent sent a Y', function () {
      var mum = FCS.parse.parse('C(1)DX/Y', 'F').fly;
      if (G.xDose(mum.chrs.X[0]) !== 2) throw new Error('an attached X is two doses');
      if (G.sexOf([mum.chrs.X[0], mum.chrs.X[1]]) !== 'F') throw new Error('two doses make a female');
      var son = FCS.parse.parse('w/Y', 'M').fly;
      if (G.sexOf([son.chrs.X[0], son.chrs.X[1]]) !== 'M') throw new Error('one dose makes a male');
    });

    return results;
  }

  FCS.tests = { run: run };
})(typeof globalThis !== 'undefined' ? globalThis : this);
