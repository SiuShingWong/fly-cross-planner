/* Your own fly list, if you have one.
 *
 * This file ships empty, and the app works perfectly well without it: the built
 * in list holds the standard balancer and marker stocks, and any genotype can be
 * typed straight into "Add a vial".
 *
 * To keep a list of your own here: load it in the app ("Load your own fly list"
 * under Fly list), press "save as my-stocks.js", and put the downloaded file
 * here, replacing this one. Or run data/build_stocks.py, which reads an .xlsx
 * and writes this file for you. Either way it loads whenever the app opens, so
 * the list travels with the folder.
 *
 * Exports FCS.myStocks — { name, rows }, your own fly list if you keep one here
 * Needs nothing. Plain data, and empty in a clean copy.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};
  FCS.myStocks = { name: '', rows: [] };
})(typeof globalThis !== 'undefined' ? globalThis : this);
