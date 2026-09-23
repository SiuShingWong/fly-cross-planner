/* Fly Cross Planner - lab corrections.
 *
 * What a balancer carries, and what one of your own alleles looks like, differ
 * between labs. Both are editable here, remembered in the browser, and can be
 * written back out as data/lab-overrides.js so they survive a re-import and can
 * be handed to someone else.
 *
 * Exports FCS.overrides — load, save, download, fileText, lookOptions, currentLook,
 *   setLook, markerChoices, setMarkers, onChange
 * Needs FCS.data and FCS.labOverrides.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};
  var KEY = 'flyCrossSim.labOverrides.v1';
  var onChange = null;

  /* ---------- remembering ---------- */

  function load() {
    var stored = null;
    try {
      var raw = root.localStorage && root.localStorage.getItem(KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (e) { stored = null; }
    /* The file on disk is the baseline; anything edited in the browser sits on top. */
    FCS.data.applyOverrides(FCS.labOverrides || { balancers: {}, alleles: {} });
    if (stored) FCS.data.applyOverrides(stored);
  }

  function save() {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(FCS.data.overrides));
    } catch (e) { /* private window, or storage is off. The file export still works. */ }
  }

  function fileText() {
    var o = FCS.data.overrides;
    return '/* Lab corrections to the marker library.\n'
      + ' * Written by the app. Drop this into data/lab-overrides.js.\n'
      + ' */\n'
      + '(function (root) {\n'
      + "  'use strict';\n"
      + '  var FCS = root.FCS = root.FCS || {};\n'
      + '  FCS.labOverrides = ' + JSON.stringify(o, null, 2).split('\n').join('\n  ') + ';\n'
      + "})(typeof globalThis !== 'undefined' ? globalThis : this);\n";
  }

  function download() {
    var blob = new root.Blob([fileText()], { type: 'text/javascript' });
    var url = root.URL.createObjectURL(blob);
    var a = root.document.createElement('a');
    a.href = url;
    a.download = 'lab-overrides.js';
    root.document.body.appendChild(a);
    a.click();
    root.document.body.removeChild(a);
    root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 1000);
  }

  function changed() {
    save();
    if (onChange) onChange();
  }

  /* ---------- what an allele can be made to look like ---------- */

  /* Every value the trait table knows, with whether there is a drawing for it.
     Values with no drawing are written beside the fly as a label instead. */
  function lookOptions() {
    var out = [{ value: '', label: 'Invisible (default)' }];
    Object.keys(FCS.data.traits).forEach(function (traitId) {
      var t = FCS.data.traits[traitId];
      Object.keys(t.rank).forEach(function (v) {
        if (v === t.wild) return;
        out.push({
          value: traitId + ':' + v,
          label: t.label + ' — ' + v + (FCS.data.isDrawn(traitId, v) ? '' : ' (labelled, not drawn)')
        });
      });
    });
    return out;
  }

  function currentLook(allele) {
    var eff = allele.effect || {}, k;
    for (k in eff) if (Object.prototype.hasOwnProperty.call(eff, k)) return k + ':' + eff[k];
    return '';
  }

  function setLook(symbol, value, dominance) {
    var effect = {};
    if (value) {
      var bits = value.split(':');
      effect[bits[0]] = bits[1];
    }
    FCS.data.setAlleleLook(symbol, effect, dominance);
    changed();
  }

  /* ---------- balancer marker sets ---------- */

  function markerChoices() {
    return Object.keys(FCS.data.alleles).filter(function (id) {
      var a = FCS.data.alleles[id];
      return !a.unknown && a.dominance === 'dominant';
    });
  }

  function setMarkers(balancerId, markers) {
    FCS.data.setBalancerMarkers(balancerId, markers);
    changed();
  }

  FCS.overrides = {
    load: load, save: save, download: download, fileText: fileText,
    lookOptions: lookOptions, currentLook: currentLook, setLook: setLook,
    markerChoices: markerChoices, setMarkers: setMarkers,
    onChange: function (fn) { onChange = fn; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
