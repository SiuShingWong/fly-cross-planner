/* Fly Cross Planner - saving the bench.
 *
 * A bench is vials of flies, what each cross came from, and the genes and map
 * positions you told the app about along the way. All of it is plain data, so
 * it packs into JSON: kept in the browser so closing the tab does not lose an
 * afternoon, and written to a file you can keep beside the folder, email to
 * whoever is running the cross, or open again months later.
 *
 * Two things are deliberately not saved. A cross result is recomputed from the
 * two parents rather than stored - it is large, and it is a pure function of
 * them - and that recomputing happens the first time a vial is looked at, not
 * while the file is opening. And flies within a vial are stored once each with a
 * list of references, because a vial of a hundred flies usually holds only a
 * handful of distinct genotypes.
 *
 * Exports FCS.bench — pack, unpack, VERSION
 * Needs FCS.data and FCS.genetics.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};
  var VERSION = 1;

  /* Genes the library does not ship with: without these, a saved fly would come
     back referring to an allele nothing has heard of. */
  function ownGenes() {
    var out = [];
    Object.keys(FCS.data.genes).forEach(function (id) {
      var g = FCS.data.genes[id];
      if (!g.unknown) return;
      out.push({ symbol: g.symbol, chr: g.chr, pos: (typeof g.pos === 'number' ? g.pos : null), approx: !!g.approx });
    });
    return out;
  }

  function packVial(v) {
    var flies = [], index = {}, refs = [];
    v.items.forEach(function (it) {
      var key = JSON.stringify(it.fly);
      if (index[key] === undefined) { index[key] = flies.length; flies.push(it.fly); }
      refs.push(it.selected ? [index[key], 1] : [index[key]]);
    });
    var meta = null;
    if (v.meta) {
      meta = {};
      Object.keys(v.meta).forEach(function (k) {
        if (k === 'result') return;                 /* recomputed from the parents */
        meta[k] = v.meta[k];
      });
    }
    return { id: v.id, name: v.name, meta: meta, flies: flies, refs: refs };
  }

  function pack(state) {
    return {
      app: 'fly-cross-sim',
      version: VERSION,
      saved: new Date().toISOString(),
      genes: ownGenes(),
      overrides: FCS.data.overrides,
      nextId: state.nextId,
      sampleSize: state.sampleSize,
      activeId: state.activeId,
      startDate: state.startDate || null,
      genDays: state.genDays || 14,
      temperature: state.temperature || 25,
      vials: state.vials.map(packVial)
    };
  }

  /* Puts the genes and corrections back first, then hands back plain vials for
     the bench to rebuild. Throws with something readable if the file is not one
     of ours. */
  function unpack(data) {
    if (!data || data.app !== 'fly-cross-sim') throw new Error('that is not a saved bench');
    if (data.version > VERSION) throw new Error('that file was saved by a newer version of the app');

    (data.genes || []).forEach(function (g) {
      var id = FCS.data.ensureAllele(g.symbol, g.chr);
      var geneId = FCS.data.alleles[id].gene;
      if (typeof g.pos === 'number') FCS.data.setGenePosition(geneId, g.pos, { approx: g.approx });
    });
    if (data.overrides) FCS.data.applyOverrides(data.overrides);

    var vials = (data.vials || []).map(function (v) {
      /* The cross is NOT recomputed here. A bench with several vials of a few
         hundred flies would then do all that work before the page appears, and
         most of it for vials you are not looking at. The parents are kept, and
         the bench recomputes a vial's result the first time it needs it. */
      var meta = v.meta || null;
      if (meta && meta.kind === 'cross' && meta.motherFly && meta.fatherFly) meta.result = null;
      return {
        id: v.id,
        name: v.name,
        meta: meta,
        items: (v.refs || []).map(function (r) {
          return { fly: v.flies[r[0]], selected: r.length > 1 };
        })
      };
    });

    return {
      nextId: data.nextId || (vials.length + 1),
      sampleSize: data.sampleSize || 100,
      startDate: data.startDate || null,
      genDays: data.genDays || 14,
      temperature: data.temperature || 25,
      activeId: data.activeId || (vials.length ? vials[vials.length - 1].id : null),
      vials: vials,
      saved: data.saved || null
    };
  }

  FCS.bench = { pack: pack, unpack: unpack, VERSION: VERSION };
})(typeof globalThis !== 'undefined' ? globalThis : this);
