/* The stocks every copy of the app starts with: the standard balancer and
 * marker stocks any Drosophila lab keeps, and nothing lab-specific. Balancers
 * are ready to use from the first minute - you do not need a stock list of your
 * own to start planning.
 *
 * Your own stocks go somewhere else: load a CSV, TSV or JSON list with "load
 * your own" under Stocks, or keep one permanently in data/my-stocks.js. Neither
 * touches this file.
 *
 *   n = name, g = genotype, d = what it is for, p = group, s = in stock
 *
 * Exports FCS.stocks — the standard balancer and marker stocks every copy ships with
 * Needs nothing. Plain data.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};
  FCS.stocks = [
{"n":"Oregon-R","g":"+","d":"Wild type","p":"background","s":1},
{"n":"w[1118]","g":"w","d":"Plain white background, the usual starting point","p":"background","s":1},
{"n":"FM7a","g":"FM7a/FM7a","d":"X balancer stock. Scored on Bar; homozygous females are viable","p":"X","s":1},
{"n":"FM7a/Y","g":"FM7a/Y","d":"X balancer males, for crossing to virgin females","p":"X","s":1},
{"n":"If/CyO","g":"w; If/CyO","d":"Second-chromosome balancer, marked with Irregular facets","p":"chromosome 2","s":1},
{"n":"Sco/CyO","g":"w; Sco/CyO","d":"Second-chromosome balancer, marked with Scutoid","p":"chromosome 2","s":1},
{"n":"Gla/CyO","g":"w; Gla/CyO","d":"Second-chromosome balancer, marked with Glazed","p":"chromosome 2","s":1},
{"n":"Sp/CyO","g":"w; Sp/CyO","d":"Second-chromosome balancer, marked with Sternopleural","p":"chromosome 2","s":1},
{"n":"Gla/SM5","g":"w; Gla/SM5","d":"Glazed over SM5. The usual second-chromosome starter: both sides marked, so every class is scorable","p":"chromosome 2","s":1},
{"n":"Gla/SM6a","g":"w; Gla/SM6a","d":"Glazed over SM6a, when stronger suppression across 2L is wanted","p":"chromosome 2","s":1},
{"n":"TM3,Sb/TM6B","g":"w; +; TM3,Sb/TM6B","d":"Third-chromosome double balancer, Stubble over Tubby","p":"chromosome 3","s":1},
{"n":"MKRS/TM6B","g":"w; +; MKRS/TM6B","d":"Marked third chromosome over the TM6B balancer","p":"chromosome 3","s":1},
{"n":"Dr/TM6C","g":"w; +; Dr/TM6C","d":"Third-chromosome balancer, marked with Drop","p":"chromosome 3","s":1},
{"n":"Pr Dr/TM6B","g":"w; +; Pr,Dr/TM6B","d":"Third-chromosome balancer with two dominant markers","p":"chromosome 3","s":1},
{"n":"Pr Dr/TM6C","g":"w; +; Pr,Dr/TM6C","d":"Prickly Drop over TM6C. Both homologues marked, so the balancer and the marked chromosome are told apart on sight","p":"chromosome 3","s":1},
{"n":"TM3,Ser/TM6B","g":"w; +; TM3,Ser/TM6B","d":"Third-chromosome double balancer, Serrate over Tubby","p":"chromosome 3","s":1},
{"n":"If/CyO; MKRS/TM6B","g":"w; If/CyO; MKRS/TM6B","d":"The double-balancing workhorse: second and third balancers in one stock, each over a dominantly marked homologue","p":"double","s":1},
{"n":"double balancer, other markers","g":"w; Sco/CyO; Dr/TM6C","d":"Second and third balancers with different dominant markers","p":"double","s":1},
{"n":"C(1)DX/Y","g":"C(1)DX,y,f/Y","d":"Attached-X females: daughters get their mother's X pair, sons their father's X. Half the zygotes die","p":"X","s":1},
{"n":"B[S]Y","g":"w/B[S]Y","d":"A Y carrying Bar of Stone, so sons are Bar-eyed and the sexes are told apart at a glance","p":"X","s":1},
{"n":"ci[D]","g":"w; +; +; ci[D]/+","d":"Fourth-chromosome marker: wing vein L4 stops short. Dominant","p":"chromosome 4","s":1},
{"n":"spa[pol]","g":"w; +; +; spa[pol]/spa[pol]","d":"Sparkling eyes, the usual recessive marker on the fourth","p":"chromosome 4","s":1},
{"n":"ci[D]/spa[pol]","g":"w; +; +; ci[D]/spa[pol]","d":"Both fourth chromosomes marked, so either can be followed","p":"chromosome 4","s":1},
{"n":"b vg","g":"b,vg","d":"Two recessive markers in cis on 2, 18.5 cM apart - a two-point cross","p":"teaching","s":1},
{"n":"y sn f","g":"y,sn,f","d":"Three X markers - a three-point cross that recovers gene order","p":"teaching","s":1},
{"n":"pr dp","g":"pr,dp","d":"Two recessive markers on 2","p":"teaching","s":1},
{"n":"vestigial","g":"vg","d":"Vestigial wings, recessive","p":"teaching","s":1},
{"n":"ebony","g":"e","d":"Ebony body, recessive marker on 3","p":"teaching","s":1}
  ];
})(typeof globalThis !== 'undefined' ? globalThis : this);
