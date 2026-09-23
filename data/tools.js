/* Standard tool stocks: plain balancer and double-balancer stocks that every
 * lab keeps but which are not in the Raff list. The planner may use these as
 * well as your own stocks, and marks them so a scheme tells you what you would
 * have to fetch.
 *
 * Exports FCS.toolStocks — balancer stocks the parked planner may reach for
 * Needs nothing. Plain data.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};
  FCS.toolStocks = [
    { n: 'tool: If/CyO', g: 'w; If/CyO', d: 'Second-chromosome balancer stock, marked with Irregular facets' },
    { n: 'tool: Sco/CyO', g: 'w; Sco/CyO', d: 'Second-chromosome balancer stock, marked with Scutoid' },
    { n: 'tool: Gla/CyO', g: 'w; Gla/CyO', d: 'Second-chromosome balancer stock, marked with Glazed' },
    { n: 'tool: TM3/TM6B', g: 'w; +; TM3,Sb/TM6B', d: 'Third-chromosome double balancer, Stubble over Tubby' },
    { n: 'tool: MKRS/TM6B', g: 'w; +; MKRS/TM6B', d: 'Third chromosome marked with Stubble over the TM6B balancer' },
    { n: 'tool: Dr/TM6C', g: 'w; +; Dr/TM6C', d: 'Third-chromosome balancer stock, marked with Drop' },
    { n: 'tool: double balancer', g: 'w; If/CyO; MKRS/TM6B', d: 'Second and third balancers in one stock' },
    { n: 'tool: Sco/CyO; Dr/TM6C', g: 'w; Sco/CyO; Dr/TM6C', d: 'Double balancer with different dominant markers' },
    { n: 'tool: FM7a', g: 'FM7a/FM7a', d: 'X balancer stock' },
    { n: 'tool: w[1118]', g: 'w', d: 'Plain white background' },
    { n: 'tool: Oregon-R', g: '+', d: 'Wild type' }
  ];
})(typeof globalThis !== 'undefined' ? globalThis : this);
