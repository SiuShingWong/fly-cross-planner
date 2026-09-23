# How this app is put together

Written for whoever picks it up next — including me, six months from now. It says
what each file is for, what the shared data looks like, what must stay true, and
how to add something without breaking the rest.

## The shape of it

No framework, no build step, no package manager. Nineteen plain `<script>` tags
in `index.html`, each file an IIFE that hangs one object on a single global,
`FCS`. Everything runs off the disk from `file://`, which is a deliberate
constraint: `fetch()` and ES modules are blocked there, so data ships as `.js`
files and nothing may be imported at runtime.

The price is that **load order matters**, and the only place it is declared is
`index.html`. The payoff is that the app keeps working with no toolchain, on any
machine, for as long as browsers run JavaScript.

    data/library.js        the marker library: genes, alleles, balancers, traits
    data/lab-overrides.js  one lab's corrections, written by the app
    data/stocks.js         the standard balancer stocks every copy ships with
    data/my-stocks.js      your own fly list, if you keep one here (ships empty)
    data/stock-source.js   which list is in use; reads CSV, TSV and JSON
    engine/genetics.js     chromosomes, meiosis, zygotes, viability, crosses
    engine/phenotype.js    genotype + sex -> what you can see
    engine/parse.js        genotype text in and out
    data/tools.js          standard balancer stocks the parked planner may use
    engine/scheme.js       the plan: crosses in order, their dates, the export
    engine/bench.js        saving and reopening the bench
    ui/flyart.js           stacks the sprite kit into a fly
    ui/vial.js             the canvas vial: flies, the CO2 pad, sorting piles
    ui/graph.js            the plan drawn as a graph
    ui/overrides.js        lab corrections: storage, the lab file, marker sets
    ui/inspector.js        the fly detail panel
    ui/mapeditor.js        map position rows and the chromosome bar
    ui/alleleprops.js      the Alleles panel
    ui/app.js              the bench: state, rendering, every event handler

Parked, still in the folder with their tests but not loaded: `engine/planner.js`,
`ui/planpane.js`, `ui/targetbuilder.js`.

### Who needs whom

    library        (nothing)
    stock-source   stocks, my-stocks
    genetics       data
    phenotype      data, genetics
    parse          data, genetics
    scheme         (nothing but its own arguments)
    bench          data, genetics
    flyart         data
    vial           flyart, genetics
    graph          (nothing; it is handed the steps)
    overrides      data
    inspector      data, flyart, genetics, mapEditor, overrides
    mapeditor      data, overrides, inspector (for esc)
    alleleprops    data, parse, overrides, mapEditor, inspector
    app            everything above

Two rules follow, and breaking either is the usual cause of a blank page:

1. **A new file goes into `index.html` after everything it needs.** The audit at
   the end of this file catches mistakes.
2. **Nothing runs at load time except defining its own namespace.** Set up in an
   `init()` that `ui/app.js` calls, never in the IIFE body.

## The data

Four shapes carry everything. Learn these and the rest reads itself.

**Haplotype** — one physical chromosome:

    { chr: '2', balancer: 'CyO' | null, alleles: { geneId: alleleId } }

**Fly** — a sex and four chromosome pairs. A male's X slot holds a Y haplotype in
position 1:

    { sex: 'F' | 'M', chrs: { X: [hap, hap], '2': [hap, hap], '3': […], '4': […] } }

Flies are plain data and are shared freely: `sample()` hands the same object to
every fly of a class, so **never mutate a fly in place** unless you mean it to
change everywhere (`relocateAllele` and `forgetAllele` in `ui/app.js` do mean it,
and walk each object once).

**Cross result** — what `FCS.genetics.cross(mother, father)` returns:

    { classes: [{ fly, p, pRaw }], dead: [{ fly, p, reason }],
      survival, lost, linkage: [...], notes: [ 'sentence', … ] }

`p` is renormalised over the survivors, so `classes` sums to 1. `linkage` says
what recombined and what could not, and why.

**Vial** — the unit the bench works in:

    { id, name, items: [{ fly, phenotype, selected }],
      meta: { kind: 'stock' | 'cross' | 'kept', … } }

`meta` carries the lineage, and that is what the plan is read from:

    stock  { kind: 'stock', genotype, newMarkers?, compounds? }
    cross  { kind: 'cross', motherFly, fatherFly, motherText, fatherText,
             result?, classes: [{label, sex, p}], setUpOn?,
             from: { mother: pick | null, father: pick | null } }
    kept   { kind: 'kept', pick, fromName, label }

    pick   { vialId, fromName, label, sex, p, n }   // where a parent came from

`meta.result` is **not** saved and may be absent after opening a file: it is
recomputed from `motherFly` and `fatherFly` the first time something asks
(`resultOf` in `ui/app.js`). Anything reading a result must go through that.

## What must stay true

- **Sex is the dose of the X**, counted by `xDose`: none is dead, one is male,
  two is female, three is dead. An attached X counts two. Never infer sex from
  "which gamete carried a Y" — that was the old rule and it broke attached-X
  crosses.
- **The X comes first in its pair, the Y second.** `normaliseX` enforces it on
  every fly the engine builds, because a son of an attached-X mother gets his X
  from his father and would otherwise be read as heterozygous.
- **Genes belong to chromosomes, alleles belong to genes.** An allele is placed
  by its gene's chromosome, never by where it was written. Only a gene of your
  own (`gene.unknown`) can be moved, and moving it clears its map position.
- **A balancer's markers are the balancer's.** They are not free loci, they do
  not recombine off, and they are not listed in the Alleles panel.
- **Two copies of the same balancer die; two different ones do not.** Marker
  lethality is separate and is what kills `MKRS/MKRS` (through `Sb`).
- **No recombination without a map position**, and none in males, on chromosome
  4, or on a chromosome carrying a suppressing balancer. The engine says why
  rather than inventing a frequency.
- **Frequencies are exact, flies are a sample.** `cross()` enumerates; `sample()`
  draws. Never report a proportion counted from drawn flies as if it were the
  expectation.
- **The genotype text is the source of truth**, and anything the library does not
  know becomes an invisible marker rather than an error.

## Adding things

**A marker.** `data/library.js`: add the gene (symbol, name, chromosome, map
position, note), then an allele with its dominance and `effect` — a trait id and
value. If the trait value has no drawing, add it to `drawnValues` only once
`art/build_art.py` makes one; until then it is labelled beside the fly instead.

**A balancer.** `data/library.js`, `balancers`: `bal(id, chr, markers, aliases,
note, opts)`. `opts.suppresses === false` for a marked chromosome that carries no
inversions (MKRS); `opts.lethal = 'none'` when homozygotes live (FM7a).

**A trait.** `data/library.js`, `traits`: give it a `wild` value and a `rank` map
— higher rank wins when two alleles touch the same trait. Then `ui/flyart.js`
needs a layer for it, and `art/build_art.py` needs to draw one.

**A panel.** Write `ui/thing.js` exporting `FCS.thing = { init, renderHtml }`,
add the script tag after its dependencies, call `FCS.thing.init()` from
`ui/app.js` `init()`, and render it from `render()`. Keep DOM ids in
`index.html`, not built in JavaScript.

**A column in the plan or its export.** `engine/scheme.js` only ever sees plain
records — genotypes as text, frequencies as numbers — so it can be tested in
node. Keep it that way: no DOM, no globals beyond `FCS.data`.

**A test.** `test/tests.js`, inside `run()`: `test('what it should do', function
() { … throw on failure … })`. `node test/run.js` runs them; `test/test.html`
runs the same file in a browser. A test that needs a new module must have it
required in `test/run.js`.

## Traps we have already fallen into

- **A `<button>` inside a `<form>` submits it.** Every button in a panel that
  lives inside one needs `type="button"`, or clicking it adds a vial.
- **`file://` caching.** A browser will serve a stale copy of one script beside a
  fresh copy of another; a mismatched pair throws. Hard reload (Cmd-Shift-R)
  before believing a bug.
- **An exception in the animation frame used to kill the loop for good.** It is
  caught and reported once now (`[fly-cross-planner] a frame threw`), with a
  watchdog that restarts a stalled loop. Keep that guard.
- **`FCS.parse.parse()` has a side effect**: an unknown allele is registered as it
  is read. Do not call it on half-typed text.
- **Referring to a parked module.** `ui/app.js` still calls
  `FCS.planner.forgetStocks()` — guarded with `if (FCS.planner && …)`. Any other
  reference to a parked namespace must be guarded the same way.
- **localStorage on `file://`** can be empty, shared between copies, or throw.
  Every read and write is wrapped; keep it that way, and never put work there —
  the bench is saved to a file on purpose.

## Checking it still hangs together

`test/audit.js` reads `index.html`, works out what each file exports and needs,
and fails if something is used before it is loaded or is not loaded at all. Run
it with the tests:

    node test/run.js && node test/audit.js
