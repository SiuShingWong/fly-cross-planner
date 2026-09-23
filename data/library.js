/* Fly Cross Planner - marker library
 *
 * Plain data. Add a gene or an allele here and the rest of the app picks it up.
 * Map positions are standard Drosophila map units (cM) from the classical maps.
 *
 * Exports FCS.data — chromosomes, traits, genes, alleles, balancers, compounds, and the
 *   editors that change them: ensureAllele, setGenePosition, moveGene,
 *   forgetAllele, setAlleleProps, setAlleleLook, setBalancerMarkers, applyOverrides
 * Needs nothing. It is first in the load order and everything else builds on it.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};

  /* Map lengths in centimorgans, and where the centromere falls on that map -
   * which is what tells you whether a gene is on the left or the right arm. The
   * X is acrocentric, so its centromere sits at the far right of the map. */
  var chromosomes = {
    X: { id: 'X', name: 'X', lengthCM: 66, centromereCM: 66, arms: ['X'], recombines: true },
    '2': { id: '2', name: '2', lengthCM: 107, centromereCM: 55, arms: ['2L', '2R'], recombines: true },
    '3': { id: '3', name: '3', lengthCM: 106, centromereCM: 47.7, arms: ['3L', '3R'], recombines: true },
    '4': { id: '4', name: '4', lengthCM: 3, centromereCM: 0, arms: ['4'], recombines: false },
    Y: { id: 'Y', name: 'Y', lengthCM: 0, centromereCM: 0, arms: ['Y'], recombines: false }
  };

  /* Traits. `rank` decides which allele wins when two affect the same trait.
   * Higher rank is more severe and is what you see. */
  var traits = {
    bodyColor: { label: 'Body colour', wild: 'wild', rank: { wild: 0, tan: 1, sable: 2, yellow: 3, black: 4, ebony: 5 } },
    eyeColor: { label: 'Eye colour', wild: 'red', rank: { red: 0, brown: 1, sepia: 2, purple: 2, white: 3 } },
    wingVein: { label: 'Wing veins', wild: 'complete', rank: { complete: 0, interrupted: 1 } },
    eyeShape: { label: 'Eye shape', wild: 'round', rank: { round: 0, sparkling: 1, bar: 1, lobe: 1, star: 1, rough: 1, glazed: 1, drop: 1, eyeless: 2 } },
    wingSize: { label: 'Wing size', wild: 'normal', rank: { normal: 0, miniature: 1, vestigial: 2, apterous: 3 } },
    wingShape: { label: 'Wing shape', wild: 'normal', rank: { normal: 0, dumpy: 1, curved: 1, scalloped: 1, serrate: 1, curly: 2 } },
    bristles: { label: 'Bristles', wild: 'normal', rank: { normal: 0, singed: 1, kinked: 1, forked: 2, spineless: 2, sternopleural: 2, prickly: 3, pin: 3, stubble: 3, scutoid: 3, shaven: 4 } },
    humeral: { label: 'Humeral bristles', wild: 'normal', rank: { normal: 0, extra: 1 } },
    halteres: { label: 'Halteres', wild: 'normal', rank: { normal: 0, enlarged: 1 } },
    bodyMarks: { label: 'Body marks', wild: 'none', rank: { none: 0, blackCells: 1 } },
    shape: { label: 'Larva and pupa', wild: 'normal', rank: { normal: 0, tubby: 1 } }
  };

  /* g(id, symbol, name, chr, pos, note) */
  function g(id, symbol, name, chr, pos, note) {
    return { id: id, symbol: symbol, name: name, chr: chr, pos: pos, note: note };
  }

  var genes = {
    y: g('y', 'y', 'yellow', 'X', 0.0, 'Cuticle and bristle pigmentation. One of the first fly mutants ever described.'),
    w: g('w', 'w', 'white', 'X', 1.5, 'The eye pigment transporter. Morgan 1910, and the reason almost every modern stock is w-.'),
    sn: g('sn', 'sn', 'singed', 'X', 21.0, 'An actin-bundling protein. Bristles come out bent and gnarled.'),
    m: g('m', 'm', 'miniature', 'X', 36.1, 'Wings reach only to the tip of the abdomen.'),
    f: g('f', 'f', 'forked', 'X', 56.7, 'Bristles are short, bent and split at the end.'),
    B: g('B', 'B', 'Bar', 'X', 57.0, 'A duplication, not a point mutation. Narrows the eye to a slit. Dominant.'),
    dp: g('dp', 'dp', 'dumpy', '2', 13.0, 'Wings truncated as if snipped off at the tip.'),
    b: g('b', 'b', 'black', '2', 48.5, 'Dark body pigment, strongest at the joints and the abdominal stripes.'),
    pr: g('pr', 'pr', 'purple', '2', 54.5, 'Blocks the brown pigment pathway. Eyes are a clear purple.'),
    vg: g('vg', 'vg', 'vestigial', '2', 67.0, 'Wings reduced to stumps. The classic wing-margin gene.'),
    se: g('se', 'se', 'sepia', '3', 26.0, 'Eyes darken to brown-black with age.'),
    e: g('e', 'e', 'ebony', '3', 70.7, 'Very dark body. Widely used as a recessive marker on chromosome 3.'),
    Cy: g('Cy', 'Cy', 'Curly', '2', 6.1, 'Wings curl upward. Dominant, and the marker that makes CyO scorable at a glance.'),
    Sb: g('Sb', 'Sb', 'Stubble', '3', 58.2, 'Bristles short and thick. Dominant, scorable on a sleeping fly.'),
    S: g('S', 'S', 'Star', '2', 1.3, 'Rough, reduced eyes. Dominant.'),
    Sp: g('Sp', 'Sp', 'Sternopleural', '2', 22.0, 'Extra sternopleural bristles. Dominant.'),
    Sco: g('Sco', 'Sco', 'Scutoid', '2', 51.0, 'Thoracic bristles missing. Dominant, and homozygous lethal, so Sco/CyO makes a stable stock.'),
    If: g('If', 'If', 'Irregular facets', '2', 56.0, 'Small, rough eyes. Dominant, homozygous lethal.'),
    Gla: g('Gla', 'Gla', 'Glazed', '2', 70.3, 'Smooth, glassy eyes. Dominant.'),
    Bc: g('Bc', 'Bc', 'Black cells', '2', 80.6, 'Black melanotic spots. Dominant, and scorable in larvae.'),
    Ki: g('Ki', 'Ki', 'Kinked', '3', 47.6, 'Bent bristles. Recessive; rides on MKRS.'),
    Pin: g('Pin', 'Pin', 'Pin', '3', 47.7, 'Short, fine bristles. Dominant, homozygous lethal.'),
    Ubx: g('Ubx', 'Ubx', 'Ultrabithorax', '3', 58.8, 'Enlarged halteres. Dominant, and the marker on TM2 and TM6.'),
    Pr: g('Pr', 'Pr', 'Prickly', '3', 90.0, 'Short, thick bristles. Dominant.'),
    Tb: g('Tb', 'Tb', 'Tubby', '3', 90.6, 'Short, fat larvae and pupae. Scored before the fly hatches, not after.'),
    Ser: g('Ser', 'Ser', 'Serrate', '3', 92.5, 'Nicked wing margins. Dominant.'),
    Dr: g('Dr', 'Dr', 'Drop', '3', 99.2, 'Small, kidney-shaped eyes. Dominant, homozygous lethal.'),
    Hu: g('Hu', 'Hu', 'Humeral', '3', 26.5, 'Extra humeral bristles. Dominant, and the second marker on TM6B.'),

    /* Chromosome 4. Tiny, and it does not recombine, so a position here is
     * decoration: what matters is that these are the markers you can score on
     * the fourth, which otherwise has nothing to hold on to. */
    ci: g('ci', 'ci', 'cubitus interruptus', '4', 0.0, 'Wing vein L4 stops short of the margin. The dominant allele ci[D] is how a fourth chromosome is usually marked.'),
    ey: g('ey', 'ey', 'eyeless', '4', 2.0, 'Eyes reduced, sometimes absent altogether. Recessive.'),
    spa: g('spa', 'spa', 'sparkling', '4', 3.0, 'Rough, glittering eyes. spa[pol] is the usual allele, and is viable and easy to score.'),
    sv: g('sv', 'sv', 'shaven', '4', 3.0, 'Bristles missing or reduced. sv[n] is homozygous lethal.')
  };

  /* These six are only ever met riding on a balancer. Their mutations have real
   * map positions, listed above for interest, but the positions are never used:
   * a balancer's inversions stop any crossover product being recovered, so the
   * marker cannot come off and nothing recombines with it. Writing Cy on its own
   * means a CyO chromosome written in a hurry, so the engine treats a chromosome
   * carrying one of these as balanced rather than recombining it at 6.1 cM.
   *
   * Two deliberate absences. B (Bar) is on FM7a but is also a genuine free X
   * marker in classical mapping, so it stays mappable. Ki rides on MKRS, which
   * carries no inversions and does not suppress, so it stays mappable too. */
  ['Cy', 'Sb', 'Ser', 'Ubx', 'Tb', 'Hu'].forEach(function (id) {
    genes[id].onBalancerOnly = true;
  });

  /* a(id, gene, symbol, name, dominance, effect, image, lethal) */
  function a(id, gene, symbol, name, dominance, effect, image, lethal) {
    return {
      id: id, gene: gene, symbol: symbol, name: name,
      dominance: dominance, effect: effect, image: image,
      lethal: lethal || 'none', sterile: false
    };
  }

  var alleles = {
    'y[1]': a('y[1]', 'y', 'y', 'yellow', 'recessive', { bodyColor: 'yellow' }, 'body_color_yellow'),
    'w[1118]': a('w[1118]', 'w', 'w', 'white', 'recessive', { eyeColor: 'white' }, 'eye_color_white'),
    'sn[3]': a('sn[3]', 'sn', 'sn', 'singed', 'recessive', { bristles: 'singed' }, 'bristles_singed'),
    'm[1]': a('m[1]', 'm', 'm', 'miniature', 'recessive', { wingSize: 'miniature' }, 'wing_size_miniature'),
    'f[1]': a('f[1]', 'f', 'f', 'forked', 'recessive', { bristles: 'forked' }, 'bristles_forked'),
    'B[1]': a('B[1]', 'B', 'B', 'Bar', 'dominant', { eyeShape: 'bar' }, 'eye_shape_bar'),
    'dp[ov1]': a('dp[ov1]', 'dp', 'dp', 'dumpy', 'recessive', { wingShape: 'dumpy' }, 'wing_shape_dumpy'),
    'b[1]': a('b[1]', 'b', 'b', 'black', 'recessive', { bodyColor: 'black' }, 'body_color_black'),
    'pr[1]': a('pr[1]', 'pr', 'pr', 'purple', 'recessive', { eyeColor: 'purple' }, 'eye_color_purple'),
    'vg[1]': a('vg[1]', 'vg', 'vg', 'vestigial', 'recessive', { wingSize: 'vestigial' }, 'wing_size_vestigial'),
    'se[1]': a('se[1]', 'se', 'se', 'sepia', 'recessive', { eyeColor: 'sepia' }, 'eye_color_sepia'),
    'e[1]': a('e[1]', 'e', 'e', 'ebony', 'recessive', { bodyColor: 'ebony' }, 'body_color_ebony'),
    'Cy[1]': a('Cy[1]', 'Cy', 'Cy', 'Curly', 'dominant', { wingShape: 'curly' }, 'wing_shape_curly', 'recessive'),
    'Sb[1]': a('Sb[1]', 'Sb', 'Sb', 'Stubble', 'dominant', { bristles: 'stubble' }, 'bristles_stubble', 'recessive'),
    'S[1]': a('S[1]', 'S', 'S', 'Star', 'dominant', { eyeShape: 'star' }, 'eye_shape_star'),
    'Sp[1]': a('Sp[1]', 'Sp', 'Sp', 'Sternopleural', 'dominant', { bristles: 'sternopleural' }),
    'Sco[1]': a('Sco[1]', 'Sco', 'Sco', 'Scutoid', 'dominant', { bristles: 'scutoid' }, null, 'recessive'),
    'If[1]': a('If[1]', 'If', 'If', 'Irregular facets', 'dominant', { eyeShape: 'rough' }, null, 'recessive'),
    'Gla[1]': a('Gla[1]', 'Gla', 'Gla', 'Glazed', 'dominant', { eyeShape: 'glazed' }),

    /* Chromosome 4 */
    'ci[D]': a('ci[D]', 'ci', 'ci[D]', 'cubitus interruptus Dominant', 'dominant', { wingVein: 'interrupted' }),
    'ci[1]': a('ci[1]', 'ci', 'ci', 'cubitus interruptus', 'recessive', { wingVein: 'interrupted' }),
    'ey[2]': a('ey[2]', 'ey', 'ey', 'eyeless', 'recessive', { eyeShape: 'eyeless' }),
    'spa[pol]': a('spa[pol]', 'spa', 'spa[pol]', 'sparkling-poliert', 'recessive', { eyeShape: 'sparkling' }),
    'sv[n]': a('sv[n]', 'sv', 'sv[n]', 'shaven-naked', 'recessive', { bristles: 'shaven' }, null, 'recessive'),

    /* Bar-Stone, the duplication carried on a marked Y. Dominant, and the
       reason B[S]Y males are told from their sisters at a glance. */
    'B[S]': a('B[S]', 'B', 'B[S]', 'Bar of Stone', 'dominant', { eyeShape: 'bar' }),
    'Bc[1]': a('Bc[1]', 'Bc', 'Bc', 'Black cells', 'dominant', { bodyMarks: 'blackCells' }),
    'Ki[1]': a('Ki[1]', 'Ki', 'Ki', 'Kinked', 'recessive', { bristles: 'kinked' }),
    'Pin[1]': a('Pin[1]', 'Pin', 'Pin', 'Pin', 'dominant', { bristles: 'pin' }, null, 'recessive'),
    'Ubx[1]': a('Ubx[1]', 'Ubx', 'Ubx', 'Ultrabithorax', 'dominant', { halteres: 'enlarged' }, null, 'recessive'),
    'Pr[1]': a('Pr[1]', 'Pr', 'Pr', 'Prickly', 'dominant', { bristles: 'prickly' }),
    'Tb[1]': a('Tb[1]', 'Tb', 'Tb', 'Tubby', 'dominant', { shape: 'tubby' }),
    'Ser[1]': a('Ser[1]', 'Ser', 'Ser', 'Serrate', 'dominant', { wingShape: 'serrate' }),
    'Dr[1]': a('Dr[1]', 'Dr', 'Dr', 'Drop', 'dominant', { eyeShape: 'drop' }, null, 'recessive'),
    'Hu[1]': a('Hu[1]', 'Hu', 'Hu', 'Humeral', 'dominant', { humeral: 'extra' })
  };
  alleles['Tb[1]'].stage = 'pupa';

  /* Everything above ships with the app: the classical markers and balancer
     markers a fly person already knows on sight. Anything created later by
     ensureAllele is a gene of the user's own, and the interface leans on that
     difference to pick out what a fly is carrying from the Gla, Pr, Dr and
     balancers it is being carried over. */
  Object.keys(alleles).forEach(function (id) { alleles[id].standard = true; });

  /* Balancers. `markers` are allele ids carried on the balancer chromosome.
   * `lethal: recessive` means two balancers for the same chromosome kill the
   * zygote. Marker map positions are the classical approximate ones; nothing
   * depends on them, because a balancer suppresses recombination anyway. */
  /* `suppresses` is what makes a balancer a balancer: the inversions stop a
   * crossover product ever being recovered, so its markers can never be
   * separated from it. A marked chromosome that carries no inversions (MKRS)
   * is written the same way but does not suppress, and says so. */
  function bal(id, chr, markers, aliases, note, opts) {
    var b = { id: id, chr: chr, name: id, markers: markers, lethal: 'recessive',
      suppresses: true, aliases: aliases || [], note: note };
    if (opts) Object.keys(opts).forEach(function (k) { b[k] = opts[k]; });
    return b;
  }

  var balancers = {
    'FM7a': bal('FM7a', 'X', ['B[1]'], ['FM7', 'FM7c', 'FM6'],
      'First Multiple 7. Balances the X, scored on Bar. Homozygous females are viable, so it makes a stock on its own. '
      + 'Eye colour is left out on purpose: it depends on the background, not on the balancer.',
      { lethal: 'none' }),
    'CyO': bal('CyO', '2', ['Cy[1]'], ['Cyo', 'CY0'],
      'Curly of Oster. The workhorse second-chromosome balancer. Homozygous lethal.'),
    'SM5': bal('SM5', '2', ['Cy[1]'], [],
      'Second Multiple 5, marked with Curly. Often paired with Gla or Sp.'),
    'SM6a': bal('SM6a', '2', ['Cy[1]'], ['SM6', 'SM1'],
      'Second Multiple 6a, marked with Curly. Stronger suppression than CyO across 2L.'),
    'TM3,Sb': bal('TM3,Sb', '3', ['Sb[1]'], ['TM3', 'TM3Sb'],
      'Third Multiple 3 carrying Stubble. The commonest third-chromosome balancer.'),
    'TM3,Ser': bal('TM3,Ser', '3', ['Ser[1]'], ['TM3Ser'],
      'TM3 marked with Serrate instead of Stubble, for when Sb is already in play.'),
    'TM6B': bal('TM6B', '3', ['Tb[1]', 'Hu[1]'], ['TM6B,Tb', 'TM6B,Tb,Hu'],
      'Marked with Tubby and Humeral. Tubby is scored on the pupa, which lets you pick genotypes before they hatch.'),
    'TM6C': bal('TM6C', '3', ['Sb[1]', 'Tb[1]'], ['TM6c', 'TM6C,Sb', 'TM6C,Sb,Tb'],
      'Carries both Stubble and Tubby, so it can be scored on adults and on pupae.'),
    'TM6': bal('TM6', '3', ['Ubx[1]'], ['TM6Ubx'],
      'Marked with Ultrabithorax. Older, and largely replaced by TM6B.'),
    'TM2': bal('TM2', '3', ['Ubx[1]'], [],
      'Third Multiple 2, marked with Ultrabithorax.'),
    'MKRS': bal('MKRS', '3', ['Sb[1]', 'Ki[1]'], ['MKRS,Sb'],
      'A marked chromosome, not a balancer: it carries no inversions, so it does not suppress recombination. '
      + 'In the usual MKRS/TM6B stock it is the TM6B that balances.',
      { suppresses: false, lethal: 'none' }),
    'Gla': bal('Gla', '2', ['Gla[1]'], ['In(2LR)Gla'],
      'In(2LR)Gla. An inversion chromosome marked with Glazed, used as the partner in SM5/Gla stocks.'),

    /* Two X chromosomes joined at one centromere, so they travel as one. A
     * C(1)DX/Y mother passes the pair to her daughters and her Y to her sons,
     * which is why sons show their father's X - the whole point of the stock.
     * Half the progeny die: C(1)DX over a paternal X is three doses of the X,
     * and Y over Y is none. */
    'C(1)DX': bal('C(1)DX', 'X', ['y[1]', 'f[1]'], ['C(1)DX,y,f', 'C(1)DX y f', 'C(1)RM', 'attached-X', 'attachedX'],
      'Compound X, marked with yellow and forked. Daughters get their mother\'s X pair, sons their father\'s X. '
      + 'Half the zygotes die, which is normal and not a fault in the cross.',
      { attached: true, lethal: 'none' })
  };

  /* Y chromosomes carrying a marker, so males can be told apart on sight.
   * A marked Y is still a Y: it carries no X genes and does not recombine. */
  var markedY = {
    'B[S]Y': { id: 'B[S]Y', markers: ['B[S]'], aliases: ['BSY', 'Dp(1;Y)B[S]', 'Dp(1;Y)BS', 'B^SY'],
      note: 'A Y carrying Bar of Stone. Sons are Bar-eyed, daughters are not, so the sexes are told apart at a glance.' },
    'y+Y': { id: 'y+Y', markers: [], aliases: ['Dp(1;Y)y+', 'y+ Y'],
      note: 'A Y carrying a wild-type yellow gene, which rescues yellow body in sons.' }
  };

  /* Chromosomes attached to each other, which balance two linkage groups at
   * once. The engine does not model them, so stocks carrying one are marked
   * rather than silently read wrong. */
  var compounds = {
    'SM6^TM6': { id: 'SM6^TM6', covers: ['2', '3'], aliases: ['SM6-TM6', 'SM6TM6'],
      note: 'An attached second and third chromosome. Segregates as one unit, which this engine does not model.' },
    'TSTL': { id: 'TSTL', covers: ['2', '3'], aliases: ['TSTL,CyO', 'T(2;3)'],
      note: 'A translocation stock balancing 2 and 3 together. Not modelled.' }
  };

  /* Trait values the sprite kit in art/ can actually draw. Anything else is
   * labelled on the fly instead. Add a value here once its artwork exists. */
  var drawnValues = {
    bodyColor: ['wild', 'yellow', 'tan', 'sable', 'black', 'ebony'],
    eyeColor: ['red', 'white', 'purple', 'sepia', 'brown'],
    eyeShape: ['round', 'bar', 'lobe', 'star', 'rough', 'glazed', 'drop', 'eyeless'],
    wingSize: ['normal', 'miniature', 'vestigial', 'apterous'],
    wingShape: ['normal', 'curly', 'curved', 'dumpy', 'scalloped', 'serrate'],
    bristles: ['normal', 'singed', 'forked', 'spineless', 'stubble', 'shaven', 'scutoid'],
    humeral: ['normal', 'extra'],
    shape: ['normal', 'tubby']
  };

  FCS.data = {
    chromosomes: chromosomes,
    drawnValues: drawnValues,
    traits: traits,
    genes: genes,
    alleles: alleles,
    balancers: balancers,
    markedY: markedY,
    compounds: compounds,
    imagePath: '../flylab_images/'
  };

  /* Most real stocks are built from alleles and transgenes no standard library
   * will ever hold: cnn[f04547], ana2, pUbq-GFP-Cnn. Rather than refuse them,
   * register each one as a marker on the chromosome it was written on, with no
   * visible phenotype. That is exactly what it is at the bench: something you
   * cannot see, so you keep it over a balancer and track it by what you can. */
  FCS.data.ensureAllele = function (symbol, chr) {
    var existing = FCS.data.alleles[symbol];
    if (existing) return existing.id;
    var geneId = 'u:' + symbol;
    if (!FCS.data.genes[geneId]) {
      FCS.data.genes[geneId] = {
        id: geneId, symbol: symbol, name: symbol, chr: chr || '2', pos: null,
        unknown: true, note: 'Not in the library. Treated as an invisible marker on chromosome ' + (chr || '2') + '.'
      };
    }
    FCS.data.alleles[symbol] = {
      id: symbol, gene: geneId, symbol: symbol, name: symbol,
      dominance: 'recessive', effect: {}, image: null, lethal: 'none',
      sterile: false, unknown: true
    };
    FCS.data.alleleVersion++;
    /* A gene of your own that has been moved or mapped before keeps that,
       even though it is only created now, when a genotype first mentions it. */
    var genePatch = FCS.data.overrides.genes[geneId];
    if (genePatch) applyGeneOverride(geneId, genePatch);
    var patch = FCS.data.overrides.alleles[symbol];
    if (patch) applyAlleleOverride(symbol, patch);
    return symbol;
  };

  /* Lab corrections. Balancer marker sets and what an allele looks like differ
   * between labs, so both are data rather than code. Overrides are applied on
   * top of the library above and are what data/lab-overrides.js carries. */
  FCS.data.overrides = { balancers: {}, alleles: {}, genes: {} };

  /* Bumped whenever an allele is added, so callers can tell a cached index is
     out of date without counting the library every time. */
  FCS.data.alleleVersion = 0;

  function applyBalancerOverride(id, patch) {
    var b = FCS.data.balancers[id];
    if (!b || !patch) return;
    if (patch.markers) b.markers = patch.markers.slice();
    if (patch.note) b.note = patch.note;
  }

  /* Where a gene sits on the map, in the FlyBase sense: chromosome arm plus a
     position in centimorgans, written 2-67.0. Only the number is kept here;
     the chromosome is already in the library. A gene with no position is left
     alone, which is honest - the engine then refuses to invent recombinants
     involving it. */
  function applyGeneOverride(id, patch) {
    var g = FCS.data.genes[id];
    if (!g || !patch) return;
    /* Only a gene of your own can be moved: a library gene's chromosome is a
       fact, not a setting. */
    if (patch.chr && g.unknown && g.chr !== patch.chr) {
      g.chr = patch.chr;
      g.note = 'Not in the library. Treated as an invisible marker on chromosome ' + patch.chr + '.';
    }
    if (patch.pos === null || patch.pos === undefined) { g.pos = null; }
    else g.pos = Number(patch.pos);
    g.approx = !!patch.approx;
    g.mapNote = patch.note || '';
    g.mapped = typeof g.pos === 'number';
  }

  function applyAlleleOverride(symbol, patch) {
    var a = FCS.data.alleles[symbol];
    if (!a || !patch) return;
    if (patch.effect) a.effect = patch.effect;
    if (patch.dominance) a.dominance = patch.dominance;
    if (patch.lethal !== undefined) a.lethal = patch.lethal;   /* 'none' has to stick too */
    if (patch.sterile !== undefined) a.sterile = !!patch.sterile;
    a.edited = true;
  }

  FCS.data.applyOverrides = function (o) {
    if (!o) return;
    Object.keys(o.balancers || {}).forEach(function (id) {
      FCS.data.overrides.balancers[id] = o.balancers[id];
      applyBalancerOverride(id, o.balancers[id]);
    });
    Object.keys(o.alleles || {}).forEach(function (sym) {
      FCS.data.overrides.alleles[sym] = o.alleles[sym];
      applyAlleleOverride(sym, o.alleles[sym]);
    });
    Object.keys(o.genes || {}).forEach(function (id) {
      FCS.data.overrides.genes[id] = o.genes[id];
      applyGeneOverride(id, o.genes[id]);
    });
  };

  /* Forget one of your own alleles entirely: the allele, its gene, and anything
   * remembered about them. For when it was a typo, or was filed somewhere wrong
   * and is easier to retype than to correct. A library allele stays put. */
  FCS.data.forgetAllele = function (symbol) {
    var a = FCS.data.alleles[symbol];
    if (!a || !a.unknown) return false;
    var geneId = a.gene;
    delete FCS.data.alleles[symbol];
    delete FCS.data.overrides.alleles[symbol];
    var others = Object.keys(FCS.data.alleles).some(function (id) {
      return FCS.data.alleles[id].gene === geneId;
    });
    if (!others) {
      delete FCS.data.genes[geneId];
      delete FCS.data.overrides.genes[geneId];
    }
    FCS.data.alleleVersion++;
    return true;
  };

  /* Put one of your own genes on a different chromosome. Happens when a genotype
   * first mentioned it with nothing to say where it belonged, so it landed on
   * the chromosome its position in the text implied. A library gene never moves.
   * The position goes with it: a distance on the old chromosome means nothing on
   * the new one. */
  FCS.data.moveGene = function (geneId, chr) {
    var g = FCS.data.genes[geneId];
    if (!g || !g.unknown || !FCS.data.chromosomes[chr]) return false;
    if (g.chr === chr) return true;
    var patch = FCS.data.overrides.genes[geneId] || {};
    patch.chr = chr;
    patch.pos = null;
    FCS.data.overrides.genes[geneId] = patch;
    applyGeneOverride(geneId, patch);
    g.pos = null;
    g.mapped = false;
    return true;
  };

  /* Give a gene a map position, or take it away again with null. */
  FCS.data.setGenePosition = function (geneId, pos, opts) {
    opts = opts || {};
    var patch = (pos === null || pos === '' || pos === undefined)
      ? { pos: null }
      : { pos: Number(pos), approx: !!opts.approx, note: opts.note || '' };
    FCS.data.overrides.genes[geneId] = patch;
    applyGeneOverride(geneId, patch);
    return patch;
  };

  /* Set what one allele looks like. Applies now and is remembered. */
  FCS.data.setAlleleLook = function (symbol, effect, dominance) {
    return FCS.data.setAlleleProps(symbol, { effect: effect || {}, dominance: dominance || 'recessive' });
  };

  /* Anything else you know about one of your own alleles: whether it is
   * homozygous lethal, what it looks like, how it behaves. Merged into whatever
   * was already set for it rather than replacing it, and remembered with the
   * other lab corrections. */
  FCS.data.setAlleleProps = function (symbol, patch) {
    var kept = FCS.data.overrides.alleles[symbol] || {};
    var merged = {};
    Object.keys(kept).forEach(function (k) { merged[k] = kept[k]; });
    Object.keys(patch || {}).forEach(function (k) { merged[k] = patch[k]; });
    FCS.data.overrides.alleles[symbol] = merged;
    applyAlleleOverride(symbol, merged);
    return merged;
  };

  FCS.data.setBalancerMarkers = function (id, markers) {
    var patch = { markers: markers.slice() };
    FCS.data.overrides.balancers[id] = patch;
    applyBalancerOverride(id, patch);
    return patch;
  };

  /* True for a gene the user told the app about, false for anything that ships
     with it. Used only for display: the gene you are following is worth
     picking out, the standard markers around it are not. */
  FCS.data.isYours = function (symbol) {
    var al = FCS.data.alleles[symbol];
    return !!al && !al.standard;
  };

  FCS.data.isDrawn = function (traitId, value) {
    var list = drawnValues[traitId];
    return !!list && list.indexOf(value) >= 0;
  };

  FCS.data.isUnknown = function (alleleId) {
    var a = FCS.data.alleles[alleleId];
    return !!(a && a.unknown);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
