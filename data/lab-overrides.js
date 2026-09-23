/* Lab corrections to the marker library.
 *
 * Edit this by hand, or use the controls in the app and press "Save lab file",
 * which writes a replacement for this file. Nothing here is required; an empty
 * file is fine.
 *
 *   balancers.<id>.markers  the allele ids this balancer carries in your hands
 *   alleles.<symbol>.effect what one of your alleles looks like, if anything
 *   alleles.<symbol>.dominance  'recessive' or 'dominant'
 *
 * Example:
 *   balancers: { 'TM6C': { markers: ['Sb[1]'] } },
 *   alleles:   { 'GFP-Cnn': { effect: { eyeColor: 'white' }, dominance: 'dominant' } }
 *
 * Exports FCS.labOverrides — one lab’s corrections, written by "Save lab file"
 * Needs nothing. Plain data.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};
  FCS.labOverrides = {
    balancers: {},
    alleles: {}
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
