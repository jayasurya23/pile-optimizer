# FINDINGS — issues found while packaging v1.1 for deployment

The optimizer's numerical engine was left untouched. Everything below is about
data getting into it, results getting out of it, and the app being readable.

## 1. Per-pile MinReveal / MaxReveal were silently dropped on .xlsx import (FIXED)

The Excel import path indexed only four columns:

```js
const ci={tid:…, n:…, e:…, g:…};          // MinReveal / MaxReveal never looked up
mapped.push({TrackerID:tid, Northing:n, Easting:…, ExistingGround:g});
```

The CSV path (`normalizeRow`) *did* read them, and both the per-tracker warm
start and the global solver consume them (`optimizeTracker` treats them as hard
per-pile boxes; `buildGlobalSolver` builds `minB`/`maxB` from them). So an Excel
file with per-pile reveal bounds was quietly optimized against the global
sliders instead — no warning, plausible-looking output.

This is the primary workflow ("import an Excel file"), and the in-app help text
promises the columns are honoured. **Fixed**: the xlsx path now resolves the same
column aliases the CSV path accepts (`MinReveal`, `min_reveal`, `min reveal`,
`minimumreveal`, `minrev`, and the `max` equivalents) and carries them through.

Verified: with `sample-pile-data.xlsx` (end piles boxed 2.5–5.5 ft, interior
2.0–6.0 ft) the fleet now solves to a 5.50 ft maximum reveal rather than the
6.00 ft slider value.

## 2. Exported "Tube Slope" and "Slope Delta" columns were always blank (FIXED)

Two independent causes, both triggered by the global site solve that runs after
the per-tracker pass:

1. `buildGlobalSolver`'s `finalize()` wrote `Slope:null, SlopeDelta:null` on
   every pile, discarding the per-pile geometry it had just computed.
2. `exportXLSX` gated those columns on
   `Method==="Terrain Follow (No Grade)"||Method==="Terrain Follow (w/ Grade)"`,
   but `finalize()` emits `"StraightLine"`, `"Pile Plan (Global)"` or
   `"Requires Regrade"` — so the gate was never true anyway.

Net effect: **the two governing geometry checks the tool exists to enforce —
tube slope and flex-joint rotation — were empty in every exported workbook.**

**Fixed**: `finalize()` now records per-pile slope and slope delta using the
same S→N convention as `buildResult` (slope at pile *i* is the span entering it;
delta is null for the first two piles), and the export writes them whenever they
are defined. Verified on the 180-pile sample: 168 slope cells and 156 delta
cells populated (180 piles − 12 tracker heads, − 24 for deltas).

## 3. Fleet Summary method counts always read zero (FIXED)

`FleetStats` counted the three per-tracker method strings, so after the global
solve relabelled results the "Straight Line / TF No Grade / TF w/ Grade" rows
all showed 0 while trackers were plainly solving. The Design Parameters sheet in
the export had the same problem.

**Fixed**: a single `classifyMethod()` helper maps both solvers' labels onto
three buckets, now displayed and exported as **Straight Line / Optimized (no
regrade) / Needs Regrade**.

## 4. The UI was a dark theme recoloured onto white (FIXED)

Help text sat at **1.61:1** contrast (`#cccccc` on white — effectively
invisible), section labels at 2.85:1, and the root container set near-white text
(`color:"#f5f5f5"`) on a white background so anything not overriding its own
colour disappeared. Borders were dark-green hairlines (`#1e4030`) left from the
original theme, and the header put red text on a near-black gradient.

**Fixed**: palette remapped to Castillo brand colours at WCAG-AA
(`scripts/rebrand_colors.py`, mechanical — colour literals only). 25+ failing
elements down to 3 marginal ones (4.18–4.49:1), all brand-specified reds.
Existing-ground and top-of-pile chart lines were also near-identical reds
(`#cc2222` vs `#cc0000`); ground is now neutral gray so the two read apart.

## 5. Open — not fixed, needs a decision

- **Solve time.** 180 piles took ~30 s on the first run; the cost is the global
  solver's up-to-80 sweeps, not the per-tracker pass. The header claims fleets up
  to 200k piles. Before the civil team runs a real site, we should time a
  representative file — if it is minutes, the sweep loop is the thing to profile.
- **Export filename** is the constant `TrackerOptimization_Results.xlsx`; repeat
  exports overwrite each other in the browser's download folder. The structural
  tool stamps job number and date into the name. Worth matching.
- **`XLSX.utils.json_to_sheet` cell styling** (`cell.s = …`) in `exportXLSX` is a
  SheetJS Pro feature. Under the CE build it is ignored, so the header fill and
  banded rows do not appear in the output. Harmless, but the code implies
  otherwise — either drop it or buy Pro.
- **`ExplanationCard` slope check** at the old line 504
  (`r.FinalReveal >= results[0]?.Violations?.length >= 0`) is a chained
  comparison that always evaluates to a boolean comparison against 0 — almost
  certainly not what was intended. It only feeds an unused local, so nothing is
  visibly wrong today.
