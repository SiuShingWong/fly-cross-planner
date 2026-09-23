# Fly Cross Planner

Open `index.html` in a browser. No install, no server, nothing to build. It works
straight off the disk in Chrome, Safari and Edge on Mac and Windows.

## What it does

- Standard balancer stocks ready from the first minute; your own list is optional.
- Type any genotype, or name a gene with its chromosome and map position, and it
  exists — nothing has to be in a database first.
- Vials open anaesthetised and sorted into piles by genotype, females first —
  the way you would look at a vial. Wake them up to watch them walk about.
- Every vial in the rack is badged with the generation it holds: **P** for a
  stock, **F1**, **F2** and so on for the progeny of each cross, deepening in
  colour. Flies lifted into a vial of their own keep the generation they came
  from.
- Click flies to sort them; "Select all like that one" does the tedious part.
- Group the anaesthetised flies into labelled piles, by phenotype (what you could
  really do with a brush) or by genotype (the X-ray view: the piles you cannot
  tell apart down the microscope). Off by default, because sorting them yourself
  is the exercise.
- "Keep selected in a new vial" lifts the flies you have sorted out into a vial
  of their own, and the scheme records which class they were and how often it
  comes up.
- "Collect another vial" draws a second vial from the same parents, for when the
  class you want did not turn up in the first hundred. Up to 1,000 offspring a
  vial.
- "save" writes the bench as a .json you can keep, send on, or open months
  later; "open" brings one back. Saving is manual — the bench starts empty each
  time you open the app.
- Discard the flies you have selected, discard a whole vial with the x beside it,
  or clear the bench with "clear all".
- Choose mothers and fathers, set up a cross, get an F1 vial at the right ratios.
- Seen against expected counts with a chi-square, and a list of the offspring
  that died before you could score them and why.
- Under that, every genotype the cross can give, grouped under the phenotype it
  hides behind, with its expected frequency and how many turned up. Two flies
  that look identical are usually the two you need to tell apart.
- A crossing scheme that writes itself: the crosses in order, what you kept out
  of each, at what frequency, saved as a Markdown file.
- A **Plan graph** tab drawing the same plan: one column per generation, time
  left to right, an arrow for the flies that go into the next cross.
- Click any fly to see its genotype, which alleles are showing, which are hidden,
  and what each gene is.
- Recombination in mothers, from map positions you enter — the app asks for one
  the moment a cross needs it and cannot invent it.

## Markers in this version

Twelve classical visible markers, all with drawings in `../flylab_images`:

| Chromosome | Markers |
| --- | --- |
| X | `y` yellow, `w` white, `sn` singed, `m` miniature, `f` forked, `B` Bar |
| 2 | `dp` dumpy, `b` black, `pr` purple, `vg` vestigial |
| 3 | `se` sepia, `e` ebony |

The balancers `FM7a`, `CyO`, `SM5`, `SM6a`, `Gla`, `TM3,Sb`, `TM3,Ser`, `TM6`,
`TM6B`, `TM6C`, `TM2` and `MKRS`, with their dominant markers `Cy`, `Sb`, `Ser`, `Ubx`,
`Tb`, `Hu`, and the stock markers `S`, `Sp`, `Sco`, `If`, `Gla`, `Bc`, `Pin`,
`Pr`, `Dr`, `Ki`. Only `Cy` and `Sb` have drawings; the rest are written beside
the fly as a label so they can still be sorted on.

`SM6^TM6` and `TSTL` are recognised by name but not modelled — they attach two
chromosomes together, which the gamete model does not handle. A vial made from
one says so rather than quietly giving wrong ratios.

## What a balancer is, in this engine

A balancer suppresses recombination, and that is the whole of its definition
here. A heterozygote for one produces only parental gametes, so a marker riding
on a balancer can never be separated from it: `b,vg/+` gives four gamete classes
and 17.6% recombinants, `b,vg/CyO` gives two and none. The panel says so rather
than printing a map position for `Cy`, which would imply it could come off.

`MKRS` is the exception and is flagged as one. It is a marked chromosome, not a
balancer — no inversions, so it does not suppress. Over a normal chromosome its
markers do recombine away; a gamete that comes through unchanged is still called
`MKRS`, a recombinant loses the name and is written out as the markers it
carries. In the usual `MKRS/TM6B` stock it is the TM6B that balances, so nothing
changes there.

## Alleles that are not in the library

Most real stocks are built from things no standard library holds: `cnn[f04547]`,
`ana2`, `Spd2NeonGreen`, `pUbq-GFP-Cnn`. The parser registers each one as a
marker on the chromosome it was written on, with **no visible phenotype** — which
is what it is at the bench. You cannot see it, so you keep it over a balancer and
track it by what you can see. The vial says which markers it registered.

A balancer written beside an unknown allele settles the chromosome for both, so
`cnn[f04547]/TM6B` puts `cnn` on 3 without being told.

**How a genotype is written.** The balancer always goes second, whichever side a
cross happened to deal it into: you read `myGene/TM6C`, never `TM6C/myGene`, and
an X always leads its Y. Two balancers keep the order you wrote them in.

**How a genotype is coloured.** The gene you told the app about is in ordinary
dark ink; everything that ships with the app — the balancers, and the classical
markers you already know on sight, `Gla`, `Pr`, `Dr`, `If`, `Sb`, `MKRS` and the
rest — is there but quiet. So the half of the slash you are actually following
is the half that catches the eye — on the CO2 pad, in the cross bar, in the table
of genotypes and in the plan graph. Nothing about the genetics changes; it is
only the reading.

**When there is nothing to go on, position decides — and that is how a gene ends
up on the wrong chromosome.** Type `cnnf` on its own and it is filed on the X,
because that is where the first segment of a genotype lives. Every later
`cnnf/SM5` is then refused with *mixes chromosomes X and 2*: the app is holding
you to what it was told the first time. The message now names which is where and
says it is yours, and the chromosome is a dropdown in "What these alleles do" —
change it and the flies already on the bench follow, the map position is cleared
(a distance on one chromosome means nothing on another), and the move is
remembered in the lab file. Library genes do not move: `vg` is on 2 and that is a
fact, not a setting.

### The Alleles panel

One panel, **Alleles**, holds everything about every allele on the bench — yours
first, then the library's. An allele of your own arrives invisible, not lethal
and unmapped, which is the right default, but you usually know more:

- **When homozygous** — not lethal, homozygous lethal, or dominant lethal. Say
  homozygous lethal and the engine kills that quarter, so it stops offering you a
  stock you could never keep and the ratios come out as they do at the bench.
- **Looks like** — a trait and a value, if the allele happens to be visible, with
  recessive or dominant.
- **Map position** — the same row as in Map positions, so recombination has a
  distance to work with.
- **Which chromosome** — a dropdown, for when it was filed wrong the first time.
  The flies on the bench follow it and the map position is cleared.
- **Also on that chromosome** — a marker sitting beside the allele in cis is a
  property of the chromosome, not of the allele, so it belongs in the genotype.
  Clicking one writes it into the genotype box (`cnnf/CyO` becomes
  `cnnf,Sb/CyO`) and you press Add vial again.
- **Delete this allele** — for a typo, or something filed so wrongly it is easier
  to retype. It goes from the library, from what is remembered about it, and off
  every fly carrying it. Library alleles cannot be deleted or moved, but their
  map positions are yours to correct.

Tick "show every allele, not only the bench" to see the whole library. The
Add-a-gene form at the top of the panel registers one before it has appeared in
any genotype.

Everything set here is remembered with the other lab corrections and written into
the lab file, so it is said once and holds wherever that allele turns up.

Two consequences worth knowing. An allele with no map position has no distance to
anything, so the engine will not generate recombinants involving it and says so
in the cross notes rather than inventing a frequency. And two unknown alleles
written with the same spelling are the same allele — spelling is the identity.

## Working backwards — parked

The reverse planner is out of the page for now. `engine/planner.js`,
`ui/planpane.js` and `ui/targetbuilder.js` are still in the folder and their
tests still run, but `index.html` does not load them and there is no tab. It
derived parents mechanically from the target, which is the right direction, but
it needs rethinking before it goes back in front of anyone.

To try it again, put the three script tags back and restore the tab block and
`#planBody` in `index.html`, and the `showPane` wiring in `ui/app.js`.

## Balancer editors

Two things differ between labs, so both are editable rather than fixed.

**What a balancer carries.** Open "What each balancer carries" in the left pane
and add or drop markers. Flies already on the bench follow the change, keeping
any cargo written on the balancer chromosome.

**What one of your alleles looks like.** Your alleles are invisible by default,
which is right for the great majority: a GFP or mCherry tag fused to the gene of
interest is cargo, not a sorting marker, and crosses are scored on the balancer.
For the exceptions, click a fly, find the allele in the panel, and set "looks
like". It holds everywhere that allele appears, including in crosses.

Edits are remembered in the browser. "Save lab file" writes a replacement for
`data/lab-overrides.js`; drop it in beside the app and the corrections survive a
re-import and can be handed to someone else.

Two deliberate omissions. Eye colour is never inferred from a balancer, because
it depends on the background rather than on the balancer — `FM7a` is scored on
Bar alone here. And GAL4 and UAS lines stay invisible, because a reporter only
shows with a driver present and the engine does not yet track that pairing.

## The stock list

The app ships with the standard balancer and marker stocks every fly lab keeps —
`If/CyO`, `Sco/CyO`, `Gla/CyO`, `Gla/SM5`, `Gla/SM6a`, `Sp/CyO`, `CyO/SM6a`,
`TM3,Sb/TM6B`, `TM3,Ser/TM6B`, `MKRS/TM6B`, `Dr/TM6C`, `Pr Dr/TM6B`,
`Pr Dr/TM6C`, `If/CyO; MKRS/TM6B`, `Sco/CyO; Dr/TM6C`, `FM7a` as a stock and as
males, plus a few teaching stocks like `b,vg` and `y,sn,f`. Balancers are
ready from the first minute and nothing in `data/stocks.js` belongs to any one
lab.

**You do not need a stock list at all.** Type a genotype into "Add a stock" and
it becomes a vial; name a gene and its chromosome in "Map positions" and it
exists. Everything the engine needs — which chromosome, which homologue, how far
apart — can be said directly.

### A list of your own

Two ways, both optional:

- **"Load your own fly list…"**, the button at the top of the Fly list panel,
  reads a CSV, TSV or JSON list in the browser. "What the file should look like"
  beside it spells out the columns, and "download a template" gives you a CSV to
  fill in:

      Stock #,Genotype,Description,Project,In stock
      JR417,"w; cnn[f04547]/CyO",from Bloomington,centriole,yes
      JR418,"w; +; Sas-6/TM6B",,centriole,yes

  Only `Genotype` is required.
  Nothing is uploaded. It needs a genotype column; stock number, description,
  project and in-stock columns are used if present, and the app reports which
  columns it took. Headers are matched loosely, a file with no header row still
  works (the genotype column is the one full of slashes and semicolons), and with
  no in-stock column every row counts as held. An .xlsx is a zip archive and
  would mean shipping a library, so the app asks you to save it as CSV instead,
  or to run `build_stocks.py`, which reads the workbook directly.
- **`data/my-stocks.js`** is loaded at startup if it holds anything, and ships
  empty. "Save as my-stocks.js" writes it from whatever list is loaded, so a list
  can live beside the app and travel with the folder.

`data/build_stocks.py` writes `data/my-stocks.js` from an .xlsx if that is easier
than exporting a CSV:

    cd data && python3 build_stocks.py

Whichever list is loaded replaces the shipped one everywhere at once — the
browser in the sidebar, the spelling search, the scheme. "Use the built-in list"
puts the standard stocks back. Everything reads `FCS.stockList()`, so no part of
the app knows whose list it is.

## The plan graph

The **Plan graph** tab beside Bench draws the plan rather than listing it: one
row per generation, time running down the page, a box per cross carrying its
name, date, the two parent genotypes and the class you keep, and an arrow to
anything that uses its flies, labelled with that class and how often it comes up.
Every label is measured against the space it has and cut with an ellipsis rather
than allowed to run past an edge; arrow labels sit just above the cross they feed,
stacked when two arrows arrive.
Two schemes with nothing between them sit in the same column, which is the point
— that is what running side by side looks like. The crosses behind the vial you
are looking at are outlined, the vial itself heavily; clicking a box selects that
vial.

It is laid out and drawn here as plain SVG, with no library, so it works off the
disk and prints as it looks. `ui/graph.js`, about 130 lines.

## Saving a crossing scheme

Every cross records where its parents were picked from and what they looked like,
so the scheme writes itself. It lives in the **Crossing scheme** panel in the
right-hand column, under the fly inspector.

**It shows the whole bench by default**, not one thread through it: every cross
you have set up, in the order they go in, each with the two parent genotypes,
which cross each parent came out of, and the class you kept with its expected
frequency ("keep the virgin females that are Bar eyes — 50.0%, about 1 in 2").
The crosses behind the vial you are looking at are marked with a line down the
side. Untick the box at the foot of the panel to see only that vial's thread.

That is deliberate: schemes usually run side by side. Two unrelated crosses set
up the same week are two entries with the same date, not a queue, and a cross
that draws a fly from an older scheme is simply one whose parent is ready later.

Steps are numbered and refer to each other — "mothers from step 1 (Cross A), the
Curly class — 50.0%" — so a scheme where two crosses feed a third still reads in
order, and the panel lists the other schemes on the bench so they are one click
away.

**Dates.** The panel carries a start date and a generation length in days (14 by
default: about ten days egg to adult at 25 °C, plus collecting virgins). From
those, every cross gets a day:

- a cross with no cross behind it goes in on the start date;
- any other follows its **last-ready** parent by one generation, so a branch is
  as long as its longest arm;
- and **any cross can be pinned to a day of its own** with the date box beside
  it — for when the parental line has to be expanded first, or the week is
  already full. Everything downstream shifts with it, and "let it follow" gives
  it back to the calculation.

The exported file opens with the span — "First cross Sep 23, 2026, a generation
taken as 14 days. 3 crosses over 2 generations; the last goes in about Nov 16" —
and carries the date on every step. Pinned dates are saved with the bench.

Three buttons under it: **Save as a file**, **copy** (to the clipboard, with a
fallback for when the browser refuses it off the disk) and **print**. The file is
Markdown you can keep, paste into a notebook or hand to whoever runs the cross.
It opens with a Mermaid flowchart, which GitHub, Notion and many editors draw as
a diagram — the only honest way to show a scheme that branches:

    ## Step 2 — Cross 2

    | | Genotype | Where it came from |
    | --- | --- | --- |
    | mothers | `w/FM7a; myGene/+` | from Cross 1, the Bar eyes class — 50.0% |
    | fathers | `w/Y; myGene/+`    | from Cross 1, the white eyes class — 50.0% |

It ends with every phenotype the last cross gives and how often, any map
distances used along the way, and the reminder about virgins.

## Keeping the bench

Saving is manual, on purpose. "save" beside Vials writes `fly-bench.json` —
vials, flies, selections, the crosses and their lineage, your own genes and their
map positions — and "open" reads one back. The bench itself starts empty every
time you open the app.

It used to save itself into browser storage as you worked and reload that at
startup. With a few vials of a couple of hundred flies that meant writing the
whole bench back every half second and reading it again before the page could
appear, which made opening the app crawl. The automatic copy is gone, and the app
clears any old one out on the way past.

Two things keep the file small and opening quick. Flies in a vial are stored once
each with a list of references, because a vial of two hundred flies usually holds
a handful of distinct genotypes. And a cross keeps its parents rather than its
result: the result is recomputed the first time you look at that vial, not while
the file is opening. A bench of 872 flies across seven vials is a 50 KB file that
opens in under a tenth of a second.

Map positions, balancer corrections and a loaded stock list are still remembered
in the browser — those are small, and they are settings rather than work.

## Recombination and map distances

Recombination is real in the engine, not decoration. Mothers recombine, fathers
never do (no meiotic recombination in Drosophila males), chromosome 4 does not,
and a balancer suppresses the whole chromosome it sits on — that last one is
what a balancer is for.

What the engine cannot do is invent a distance. Two markers in cis need a map
position each, and for your own lines nobody knows them but you. So the app asks:

- Set a mother and the cross bar says what will happen — either "chromosome 2 is
  recombining in the mother: b–cn 9.0 cM, 8.9% recombinant gametes (Kosambi)" or
  that a position is missing, with a box for each gene right there.
- Cross anyway and the vial says the same thing, with the same boxes and a
  "cross those parents again" button, so you can fill the map in and re-run the
  same parents.
- "Map positions" in the left pane, above the fly list, lists every gene on the
  bench, unmapped ones first. Click a gene's name and it is drawn on its
  chromosome: a centimorgan scale, the centromere as a grey dot so you can see
  which arm it is on, and the other mapped genes as faint ticks. The same bar
  appears under each allele when you click a fly. Tick "show every gene, not only the bench" to read off, or correct, every
  position the library holds — the twelve classical markers and the dominant
  balancer markers are all there, `b` at 2-48.5, `vg` at 2-67.0 and so on.
- Clicking a fly also names the position for each allele it carries, or says the
  position is not known. On a balancer it says the marker cannot be separated
  from it at all, which is the more useful fact.

You enter what FlyBase lists: it writes the position as `2-67.0`, the chromosome
then centimorgans, and the app already knows the chromosome, so only the number
is asked for. One number per gene serves every pair, and it fixes gene order
along the chromosome, which a bare pair distance cannot.

### Adding a gene of your own

The form at the top of "Map positions" takes a name, a chromosome and, if you
have it, a position: `cnn[f04547]`, 3, 55.2. That registers the gene there and
then, so you can give it a distance before it has ever appeared in a genotype.
It is invisible like every allele of your own, so write it over a balancer —
`cnn[f04547]/TM6B` — and track it by what you can see. Typing it into a genotype
still works and does the same registration, just without the position.

### Balancer markers have no distance

`Cy`, `Sb`, `Ser`, `Ubx`, `Tb` and `Hu` are only ever met riding on a balancer,
so they are not listed as mappable and the panel says why: the inversions stop
any crossover product being recovered, and the marker cannot come off. Their
mutations do have real positions — `Cy` is 2-6.1 — and the fly inspector says so
in passing, but nothing uses them.

This also fixes a way of writing things that used to give a wrong answer.
`Cy,b/+` is a `CyO` chromosome written in a hurry, not a free Curly marker 42 cM
from black; the engine now treats that chromosome as balanced and says so,
instead of generating 20% recombinants that could never exist.

Two deliberate exceptions. `B` (Bar) sits on `FM7a` but is also a genuine free X
marker in classical mapping, so it stays mappable. `Ki` rides on `MKRS`, which
carries no inversions and does not suppress, so its markers really can come off
— and they still do.

**A gene you never mapped stays unmapped.** That is the honest state for a line
you made yourself: the engine carries both chromosomes through intact and says
why, rather than reporting a frequency nobody measured. If you have a rough idea,
enter it and tick "estimate" — every cross that uses it then says one of the
positions is approximate.

Distances become recombination fractions through Kosambi, `r = 0.5 ·
tanh(d/50)`, which allows for interference; over short distances it is close to
`d/100`. Positions are remembered in the browser and written into the lab file
by "Save lab file", so they travel with the folder.

## Writing a genotype

A slash separates the two homologues, semicolons separate chromosomes.

    vg                   vg/vg on chromosome 2
    w; vg/CyO            white X, vestigial over CyO
    y,sn,f               three X markers in cis
    b,vg/+ ; e           two chromosome-2 markers in cis, ebony on 3

Two rules worth knowing. Every allele goes to its **own** chromosome whatever
position you wrote it in, so a bare `vg` lands on 2 rather than on the X. And
**case matters**: `b` is black, `B` is Bar. Balancer names are forgiving —
`CyO`, `Cyo` and `cyo` are all read as CyO.

## How the flies are drawn

Out of the FlyLab drawings in `../flylab_images`, which are a mixture: some are
whole flies (`sex_*`, `wing_size_*`, `body_color_*`) and some are isolated parts
(`eye_*` is a head, `bristles_*` is a thorax, `wing_shape_*` is one wing).

`art/build_art.py` turns them into a kit that can be stacked: a wingless body in
each body colour and sex, a head capsule, the eyes as a layer of their own, a
thorax with its bristles, and a wing. Body colour is applied to the body, the
thorax and the head capsule, but not to the eyes, so eye colour and body colour
combine freely. Run it again after editing a colour:

    cd art && python3 build_art.py

`test/sprite_sheet.png` shows twenty-four assembled phenotypes, including every
balancer marker, for checking the result.

Three markers are drawn by reworking the kit rather than from a supplied
drawing: `Tb` squashes the whole assembled fly, `Ser` cuts notches out of the
wild-type wing, and `Dr`, `If` and `Gla` rework the eye layer. `B` is drawn
narrower than the supplied Bar drawing, which is only slightly narrower than
wild type and does not read at sprite size.

Two things about the source drawings worth knowing. **Some are mislabelled**:
`eye_color_white` is brown and `eye_color_brown` is white; `eye_color_purple` is
nearly black and `eye_color_sepia` is purple; the `body_color_*` names do not
match their colours either. The build script does not use those files — it
recolours from the wild-type drawing instead — so the app is right whatever the
names say. And there is **nothing here for balancer markers**: no `Tb`, `Hu`,
`Ser`, `Dr` or `Sco`, and no pupa. This set covers the classical visible
markers only, so `TM6B` and `TM6C` will need drawings of their own.

## Layout

    index.html            the page
    css/style.css
    art/build_art.py      builds the sprite kit from ../flylab_images
    art/*.png             the sprite kit (134 files, generated)
    data/library.js       genes, alleles, balancers — edit this to add markers
    data/stocks.js        the standard balancer stocks every copy ships with
    data/stock-source.js  which stock list is in use; reads CSV, TSV and JSON
    data/my-stocks.js     your own list, if you have saved one (ships empty)
    engine/genetics.js    chromosomes, meiosis, zygotes, viability
    engine/phenotype.js   genotype + sex -> what you see
    engine/parse.js       genotype text in and out
    engine/scheme.js      the crossing scheme, read off the bench
    engine/bench.js       saving and reopening the bench
    engine/planner.js     the backwards search (parked, not loaded)
    data/tools.js         standard balancer stocks the planner may use
    ui/flyart.js          stacks the sprite kit into a fly
    ui/graph.js           the plan drawn as a graph
    art/logo.svg          the mark: two homologues crossing, with a fly on them
    ui/vial.js            the canvas vial and the CO2 pad
    ui/inspector.js       the fly detail panel
    ui/mapeditor.js       map positions, in the sidebar and beside a cross
    ui/targetbuilder.js   the chromosome slot builder (parked)
    ui/planpane.js        the planning panel (parked)
    ui/app.js             the bench
    test/run.js           engine tests
    test/sprite_sheet.png assembled phenotypes, for checking the art

## Adding a marker

Everything lives in `data/library.js`. Add the gene with its chromosome and map
position, add an allele pointing at it with the trait it changes, and name the
image in `flylab_images`. Nothing else needs touching.

## Before you change anything

`ARCHITECTURE.md` is the map: what each file is for, the four data shapes
everything is built from, the rules that must stay true, and recipes for adding a
marker, a balancer, a trait, a panel or a test. `test/audit.js` checks that the
script tags in `index.html` still list every file after the ones it needs — the
one thing with no build step to catch it.

## Checkpoints

`../checkpoints/` holds dated snapshots of the whole folder, each a `.zip` plus a
`.txt` manifest listing every file with its size and a short hash, the test
result at the time, and how to restore it: unzip over an empty folder and open
`index.html`. Take one before a stretch of changes; they are cheap (about 3 MB,
most of it the sprite kit).

## Tests

    node test/run.js
    node test/audit.js

Sixty-one tests covering the ratios that matter: 3:1, 1:1, sex linkage in both
directions, balancer lethality giving 2:1, a two-point cross recovering 17.7%
from the map, no recombination through fathers, a three-point cross recovering
gene order from its rarest class, 9:3:3:1 across chromosomes, the parser, reading a stock list of your own, map
positions entered by hand turning recombination on, a balancer still suppressing
it, a balancer marker written loose refusing to recombine while MKRS still lets
its markers off, the fourth chromosome refusing to recombine, a marked Y whose
marker shows, an attached-X cross giving its mother's daughters and its father's
sons with half the vial dead, a crossing scheme read back in order with the frequencies
you kept at and a branching one numbering its steps, a bench that packs and comes
back with its flies and selections, and the parked planner — including one that re-runs every cross in a returned scheme and
checks that the class it asks you to pick really does come up at the frequency
it claims.

## How random the flies are

Two different things, and it matters which is which.

**The frequencies are exact.** Every gamete of both parents is enumerated with
its probability — including recombinants, at the fraction the map gives — then
every zygote, then the ones that cannot survive are removed and the rest
renormalised. Nothing is sampled to get there, so "12.5%, about 1 in 8" is
arithmetic, not an estimate.

**The flies in the vial are a sample.** The app then draws the offspring one at a
time from that distribution, independently, like scoring a real vial. That is why
Seen and Expected differ, why there is a chi-square under the table, and why
crossing the same parents twice gives two different vials. A draw of 20,000 from
a 42-class cross sits within half a percentage point of every expected frequency.

A consequence worth knowing: a rare class may not appear at all. With 100
offspring, a 1-in-200 genotype turns up about two times in five. That is true at
the bench too — collect another vial, or raise the offspring count, which is what
"Collect another vial" and the 1,000 setting are for.

## If the flies stop moving

The animation used to be one requestAnimationFrame chain with nothing catching
errors: a single exception in a frame ended it for good, and the page looked
fine except that the flies had frozen mid-step. Now a bad frame is skipped and
reported once in the console as `[fly-cross-sim] a frame threw`, a watchdog
restarts the loop if it stalls for two seconds, and the loop is nudged again
when the tab is shown, focused, or restored from the back/forward cache.

If they still freeze, open the console (Mac: Cmd-Option-J in Chrome, or
Develop → Show JavaScript Console in Safari) and pass on whatever it says. Worth
trying first: a hard reload, Cmd-Shift-R. Off the disk a browser will happily
serve a stale copy of one script beside a fresh copy of another, and a mismatched
pair throws exactly this kind of error.

## The awkward chromosomes

**Chromosome 4.** `ci[D]` (wing vein L4 stops short, dominant), `ci`, `ey`
(eyeless), `spa[pol]` (sparkling eyes) and `sv[n]` are in the library, with
`ci[D]`, `spa[pol]` and `ci[D]/spa[pol]` as shipped stocks. The fourth does not
recombine, so a map position there is decoration; what matters is having
something to score.

**A marked Y.** `B[S]Y` — a Y carrying Bar of Stone — is written where a Y goes:
`w/B[S]Y`. The marker is expressed, so sons are Bar-eyed and their sisters are
not, which is the whole point. `Dp(1;Y)B[S]`, `BSY` and `B^SY` all read as the
same thing. Anything on a marked Y is still on a Y: no X genes, no recombination.

**Attached X.** `C(1)DX,y,f/Y` is two X chromosomes joined at one centromere, so
they travel as a unit. The engine models it properly rather than flagging it:

- Sex follows the **dose of the X**, not which parent sent a Y. Two doses make a
  female, whatever Y is present; `C(1)DX/Y` is a female.
- Daughters get their mother's X pair, sons their father's X — so a son shows
  what his father was carrying, which is why the stock exists.
- Half the zygotes die and the vial says why: `C(1)DX` over a paternal X is three
  doses of the X, and Y over Y is none. That is the cross working, not failing.

**Generation length follows temperature.** The scheme panel has 18, 22, 25 and
29 °C, setting 28, 19, 14 and 11 days; the number stays editable, and the
temperature goes into the exported plan.

## Balancers, lethality and what dies

A balancer carries its own recessive lethal, so **two copies of the same
balancer die** — `CyO/CyO`, `TM6B/TM6B`. Two **different** balancer or marked
chromosomes over each other do not: each one's lethal is covered by the other,
which is exactly why `TM3,Sb/TM6B`, `MKRS/TM6B` and `Gla/CyO` are stocks you can
keep on the shelf.

`MKRS` is not a balancer at all — no inversions, so it does not suppress
recombination, and it carries no lethal of its own. `MKRS/MKRS` still dies, but
through its own `Sb`, which is homozygous lethal. Same for a marker like `If`:
`If/CyO` is a perfectly good fly, `If/If` is not.

The engine assumes two different balancers never share a lethal. A few real pairs
do — `CyO/SM6a` for one, since both carry `Cy[1]` — and the engine gets that
right by the marker rather than the balancer.

## Known simplifications

- Two different balancers are assumed not to share a recessive lethal.
- Balancers suppress recombination across the whole chromosome. Real balancers
  leave the tips exposed.
- No crossover interference, so double crossovers are slightly over-reported.
  Kosambi partly compensates.
- `Tb` is scored on the pupa in real life; here it is drawn on the adult as
  short and fat, because the app has no pupal stage yet.
- `Hu` is additive, so it has a layer of its own and shows alongside `Sb`. The
  other bristle markers share one trait slot, so the most severe wins — two of
  them on the same fly would show only one.
- Sprites are assembled at fixed positions tuned against a photograph, on a
  200 x 212 canvas so a full-length wing has room. The wing is placed by its
  root — the narrow point at the top of the wing drawing — and mirrored about
  that same point, so both wings hinge on the thorax. Males are drawn at 0.9,
  since they really are the smaller sex. `FCS.flyart.tune({...})` nudges any of
  these from the console; the settled numbers live at the top of
  `ui/flyart.js`, and the same ones are repeated in `whole_fly()` in
  `art/build_art.py` for the trait pictures.
# fly-cross-planner
