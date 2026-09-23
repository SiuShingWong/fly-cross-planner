/* Fly Cross Planner - genotype to what you see down the scope.  *
 * Exports FCS.phenotype — of, label, traitImage, phrase, classes, carriedOn, wildTraits
 * Needs FCS.data and FCS.genetics.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};

  var PHRASE = {
    bodyColor: { yellow: 'yellow body', black: 'black body', ebony: 'ebony body', tan: 'tan body', sable: 'sable body' },
    eyeColor: { white: 'white eyes', purple: 'purple eyes', sepia: 'sepia eyes', brown: 'brown eyes' },
    eyeShape: { bar: 'Bar eyes', lobe: 'Lobe eyes', star: 'Star eyes', rough: 'rough eyes',
      glazed: 'glazed eyes', drop: 'Drop eyes', eyeless: 'eyeless', sparkling: 'sparkling eyes' },
    wingVein: { interrupted: 'broken wing vein' },
    wingSize: { miniature: 'miniature wings', vestigial: 'vestigial wings', apterous: 'no wings' },
    wingShape: { dumpy: 'dumpy wings', curly: 'Curly wings', curved: 'curved wings',
      scalloped: 'scalloped wings', serrate: 'nicked wing margins' },
    bristles: { singed: 'singed bristles', forked: 'forked bristles', stubble: 'Stubble bristles',
      spineless: 'spineless', shaven: 'shaven bristles', scutoid: 'bristles missing', pin: 'Pin bristles',
      prickly: 'Prickly bristles', kinked: 'kinked bristles', sternopleural: 'extra sternopleural bristles' },
    humeral: { extra: 'extra humeral bristles' },
    shape: { tubby: 'short and fat' },
    halteres: { enlarged: 'enlarged halteres' },
    bodyMarks: { blackCells: 'black cells' }
  };

  /* Image used by the inspector for a trait value, when there is one. */
  var TRAIT_IMAGE = {
    bodyColor: { wild: 'body_color_wild_type', yellow: 'body_color_yellow', black: 'body_color_black', ebony: 'body_color_ebony', tan: 'body_color_tan', sable: 'body_color_sable' },
    eyeColor: { red: 'eye_color_wild_type', white: 'eye_color_white', purple: 'eye_color_purple', sepia: 'eye_color_sepia', brown: 'eye_color_brown' },
    eyeShape: { round: 'eye_shape_wild_type', bar: 'eye_shape_bar', lobe: 'eye_shape_lobe', star: 'eye_shape_star', eyeless: 'eye_shape_eyeless' },
    wingSize: { normal: 'wing_size_wild_type', miniature: 'wing_size_miniature', vestigial: 'wing_size_vestigial', apterous: 'wing_size_apterous' },
    wingShape: { normal: 'wing_shape_wild_type', dumpy: 'wing_shape_dumpy', curly: 'wing_shape_curly', curved: 'wing_shape_curved', scalloped: 'wing_shape_scalloped' },
    bristles: { normal: 'bristles_wild_type', singed: 'bristles_singed', forked: 'bristles_forked', stubble: 'bristles_stubble', spineless: 'bristles_spineless', shaven: 'bristles_shaven' }
  };

  function wildTraits() {
    var t = {}, k;
    for (k in FCS.data.traits) if (Object.prototype.hasOwnProperty.call(FCS.data.traits, k)) t[k] = FCS.data.traits[k].wild;
    return t;
  }

  function rank(traitId, value) {
    var t = FCS.data.traits[traitId];
    return (t && t.rank && t.rank[value] !== undefined) ? t.rank[value] : 0;
  }

  /* Which named chromosome, if any, is carrying this gene in this fly. A marker
     on a balancer cannot be separated from it, so it is not really a locus with
     a map position any more. */
  function carriedOn(f, chrId, geneId) {
    var pair = f.chrs[chrId], i;
    for (i = 0; i < 2; i++) {
      if (pair[i].balancer && pair[i].alleles[geneId]) return pair[i].balancer;
    }
    return null;
  }

  function phenotype(f) {
    var G = FCS.genetics;
    var traits = wildTraits();
    var expressed = [], carried = [];

    G.CHRS.forEach(function (chrId) {
      G.genesOn(f, chrId).forEach(function (geneId) {
        var ap = G.allelePair(f, chrId, geneId);
        var al0 = ap.a0 ? FCS.data.alleles[ap.a0] : null;
        var al1 = ap.a1 ? FCS.data.alleles[ap.a1] : null;
        var present = [al0, al1].filter(Boolean);
        if (!present.length) return;

        var dominantOne = present.filter(function (a) { return a.dominance === 'dominant'; })[0];
        var show = null, zygosity = '';

        if (dominantOne) {
          show = dominantOne;
          zygosity = (al0 && al1) ? 'homozygous' : (ap.hemizygous ? 'hemizygous' : 'heterozygous');
        } else if (ap.hemizygous) {
          show = al0; zygosity = 'hemizygous';
        } else if (al0 && al1) {
          show = (al0 === al1 || al0.id === al1.id) ? al0 : al0;
          zygosity = (al0.id === al1.id) ? 'homozygous' : 'compound heterozygote';
        }

        var entry = {
          chr: chrId, geneId: geneId, gene: FCS.data.genes[geneId],
          alleles: present.map(function (a) { return a.id; }),
          zygosity: zygosity,
          onBalancer: carriedOn(f, chrId, geneId)
        };

        if (show) {
          entry.allele = show;
          expressed.push(entry);
          var k;
          for (k in show.effect) {
            if (Object.prototype.hasOwnProperty.call(show.effect, k)) {
              if (rank(k, show.effect[k]) > rank(k, traits[k])) traits[k] = show.effect[k];
            }
          }
        } else {
          entry.allele = present[0];
          entry.zygosity = 'heterozygous, not expressed';
          carried.push(entry);
        }
      });
    });

    /* Markers with no drawing yet are written beside the fly instead, so they
       can still be sorted on. If the trait has a phrase of its own the label
       already says it, and the badge would only repeat it there - it is still
       drawn on the canvas. */
    var badges = [], quiet = [];
    expressed.forEach(function (e) {
      var eff = e.allele.effect || {}, k;
      for (k in eff) {
        if (!Object.prototype.hasOwnProperty.call(eff, k)) continue;
        if (FCS.data.isDrawn(k, eff[k])) continue;
        if (badges.indexOf(e.allele.symbol) < 0) badges.push(e.allele.symbol);
        if (PHRASE[k] && PHRASE[k][eff[k]] && quiet.indexOf(e.allele.symbol) < 0) quiet.push(e.allele.symbol);
      }
    });
    var spoken = badges.filter(function (b) { return quiet.indexOf(b) < 0; });

    return {
      sex: f.sex,
      traits: traits,
      expressed: expressed,
      carried: carried,
      badges: badges,
      label: label(traits, spoken),
      key: key(f.sex, traits) + (badges.length ? '|' + badges.join(',') : '')
    };
  }

  function label(traits, badges) {
    var bits = [], k;
    for (k in traits) {
      if (!Object.prototype.hasOwnProperty.call(traits, k)) continue;
      if (traits[k] === FCS.data.traits[k].wild) continue;
      var phrase = PHRASE[k] && PHRASE[k][traits[k]];
      if (phrase) bits.push(phrase);
    }
    if (badges && badges.length) bits = bits.concat(badges);
    return bits.length ? bits.join(', ') : 'wild type';
  }

  function key(sex, traits) {
    var ks = Object.keys(traits).sort();
    return sex + '|' + ks.map(function (k) { return k + '=' + traits[k]; }).join(',');
  }

  function traitImage(traitId, value) {
    var m = TRAIT_IMAGE[traitId];
    return m && m[value] ? m[value] : null;
  }

  /* Group the exact classes of a cross by what you can actually see. */
  function phenotypeClasses(result) {
    var by = {}, out = [];
    result.classes.forEach(function (c) {
      var ph = phenotype(c.fly);
      if (by[ph.key]) { by[ph.key].p += c.p; by[ph.key].genotypes.push(c); }
      else {
        by[ph.key] = { key: ph.key, phenotype: ph, p: c.p, genotypes: [c] };
        out.push(by[ph.key]);
      }
    });
    out.sort(function (a, b) { return b.p - a.p; });
    return out;
  }

  FCS.phenotype = {
    of: phenotype,
    label: label,
    traitImage: traitImage,
    phrase: PHRASE,
    classes: phenotypeClasses,
    carriedOn: carriedOn,
    wildTraits: wildTraits
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
