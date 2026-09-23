/* Fly Cross Planner - the planning panel.
 *
 * Build the fly you want, and it works back one generation: which two parents
 * would give it, which class of their offspring to keep, and whether you
 * already have either parent. Work back again from a parent to go further.
 *
 * Exports FCS.planPane — init (PARKED: not loaded by index.html)
 * Needs FCS.planner, FCS.targetBuilder, FCS.parse, FCS.genetics, FCS.inspector.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};
  var esc, pool = null, last = null, registered = false, onLoad = null;

  function ensureRegistered() {
    if (registered) return;
    FCS.planner.registerStockAlleles(FCS.stockList());
    registered = true;
  }

  function poolFor(fly) {
    return FCS.planner.buildPool({ needles: FCS.planner.needlesFor(fly) });
  }

  function sourceTag(source) {
    if (source === 'held') return '<span class="tag ok">in stock</span>';
    if (source === 'tool') return '<span class="tag">standard stock</span>';
    return '<span class="tag warn">no longer held</span>';
  }

  function oneIn(p) {
    if (p <= 0) return '';
    var n = Math.round(1 / p);
    return n <= 1 ? 'nearly all of them' : 'about 1 in ' + n;
  }

  function parentCard(fly, role, constrain, pool) {
    var G = FCS.genetics;
    var text = G.genotypeString(fly);
    var match = FCS.planner.findStock(fly, constrain, pool);
    var have = match
      ? '<div class="have">' + sourceTag(match.source) + ' <strong>' + esc(match.name) + '</strong>'
        + '<div class="dim mono">' + esc(match.genotype) + '</div></div>'
      : '<div class="have"><span class="tag warn">you would need to make or request this</span></div>';
    return '<div class="parent">'
      + '<div class="parent-role">' + (role === 'F' ? '&#9792; mother' : '&#9794; father') + '</div>'
      + '<div class="mono parent-geno">' + esc(text) + '</div>'
      + have
      + '<div class="parent-acts">'
      + '<button class="link-btn" data-back="' + esc(text) + '">work back from this one</button>'
      + '<button class="link-btn" data-loadstock="' + esc(text) + '|' + esc(match ? match.name : text)
      + '">put on the bench</button>'
      + '</div></div>';
  }

  function render(result, constrain, pool, target) {
    var el = document.getElementById('planResult');
    if (!result.ok) {
      el.innerHTML = '<div class="plan-no">' + esc(result.reason) + '</div>';
      return;
    }
    var html = '';
    var already = FCS.planner.findStock(target, constrain, pool);
    if (already) {
      html += '<div class="plan-ok">You already have this: <strong>' + esc(already.name) + '</strong>'
        + ' <span class="mono dim">' + esc(already.genotype) + '</span>.'
        + ' The cross below is how it would be made, or kept going.</div>';
    }
    html += '<div class="plan-ok">One cross. Keep the <strong>'
      + (result.sex === 'F' ? 'virgin females' : 'males') + '</strong> that are <strong>'
      + esc(result.label) + '</strong> &mdash; ' + (result.fraction * 100).toFixed(1)
      + '% of the vial, ' + oneIn(result.fraction)
      + (result.amongN > 1 ? '. Careful: ' + (result.amongN - 1) + ' other genotype'
        + (result.amongN > 2 ? 's look' : ' looks') + ' the same, so only '
        + Math.round(result.share * 100) + '% of what you keep is right.' : '.')
      + '</div>'
      + '<div class="parents">' + parentCard(result.mother, 'F', constrain, pool)
      + '<div class="times">&times;</div>'
      + parentCard(result.father, 'M', constrain, pool) + '</div>'
      + '<div class="dim">' + Math.round(result.lost * 100)
      + '% of the zygotes die before you see them, which is why the class you want is not a quarter.</div>';

    if (result.amongN > 1) {
      html += '<div class="plan-warn">Looks the same:<ul>'
        + result.lookAlikes.map(function (l) { return '<li class="mono">' + esc(l) + '</li>'; }).join('')
        + '</ul></div>';
    }
    html += '<p class="reminder">Both mothers have to be virgins.</p>';
    el.innerHTML = html;
  }

  function run() {
    var text = document.getElementById('planTarget').value.trim();
    var out = document.getElementById('planResult');
    if (!text) { out.innerHTML = ''; return; }
    out.innerHTML = '<div class="dim">Working back…</div>';

    root.setTimeout(function () {
      ensureRegistered();
      var parsed = FCS.parse.parse(text, 'F');
      if (!parsed.ok) {
        out.innerHTML = '<div class="plan-no">Could not read that: ' + esc(parsed.unknown.join(', ')) + '</div>';
        return;
      }
      var result;
      try { result = FCS.planner.deriveOneGeneration(parsed.fly, parsed.specified); }
      catch (e) { out.innerHTML = '<div class="plan-no">' + esc(e.message) + '</div>'; return; }
      var constrain = result.constrain || parsed.specified;
      pool = poolFor(parsed.fly);
      last = { text: text, result: result, constrain: constrain };
      render(result, constrain, pool, parsed.fly);
    }, 20);
  }

  function setTarget(text) {
    document.getElementById('planTarget').value = text;
    FCS.targetBuilder.setFromText(text);
    run();
  }

  function init(onLoadStock) {
    esc = FCS.inspector.esc;
    onLoad = onLoadStock;
    ensureRegistered();

    FCS.targetBuilder.init(document.getElementById('slotBuilder'), function (text) {
      document.getElementById('planTarget').value = text;
    });

    document.getElementById('btnPlan').addEventListener('click', run);
    var box = document.getElementById('planTarget');
    box.addEventListener('change', function () { FCS.targetBuilder.setFromText(box.value); });
    box.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); FCS.targetBuilder.setFromText(box.value); run(); }
    });
    document.getElementById('btnPlanClear').addEventListener('click', function () {
      box.value = '';
      FCS.targetBuilder.clear();
      document.getElementById('planResult').innerHTML = '';
    });

    document.getElementById('planResult').addEventListener('click', function (ev) {
      var back = ev.target.closest('[data-back]');
      if (back) { setTarget(back.getAttribute('data-back')); return; }
      var load = ev.target.closest('[data-loadstock]');
      if (load) {
        var bits = load.getAttribute('data-loadstock').split('|');
        onLoad(bits[1], bits[0]);
      }
    });
  }

  FCS.planPane = { init: init, run: run, setTarget: setTarget };
})(typeof globalThis !== 'undefined' ? globalThis : this);
