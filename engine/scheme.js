/* Fly Cross Planner - the crossing scheme.
 *
 * A scheme is what you would write in a notebook before starting: the crosses
 * in order, what you keep out of each vial, and how often that class turns up.
 * The app already knows all three, because every cross vial records its parents
 * and where they were picked from, so the scheme is read off the bench rather
 * than typed up afterwards.
 *
 * It works on plain records - genotypes as text, frequencies as numbers - so it
 * can be tested without a browser and written out as a file you can keep.
 *
 * Exports FCS.scheme — chain, steps, plan, schedule, toMarkdown, toMermaid, keptFrom,
 *   dateFor, dayName, isoDay
 * Needs nothing: it is handed plain records and returns plain records, which is
 *   what lets it be tested in node.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};

  /* Every cross that led to this vial, ancestors first, each one once. */
  function chain(vialId, vials) {
    var byId = {}, out = [], seen = {};
    vials.forEach(function (v) { byId[v.id] = v; });
    (function walk(id) {
      var v = byId[id];
      if (!v || seen[id]) return;
      if (!v.meta || v.meta.kind !== 'cross') return;
      seen[id] = true;
      var from = v.meta.from || {};
      if (from.mother) walk(from.mother.vialId);
      if (from.father) walk(from.father.vialId);
      out.push(v);
    })(vialId);
    return out;
  }

  function oneIn(p) {
    if (!p || p <= 0) return '';
    var n = Math.round(1 / p);
    return n > 1 ? ', about 1 in ' + n : '';
  }

  function pct(p) { return (p * 100).toFixed(1) + '%'; }

  /* What was taken out of this vial, and how often it comes up. Read from the
     children that used it, so it is what you actually did, not a guess. */
  function keptFrom(vial, vials) {
    var out = [], seen = {};
    vials.forEach(function (child) {
      var from = (child.meta && child.meta.from) || {};
      ['mother', 'father'].forEach(function (side) {
        var pick = from[side];
        if (!pick || pick.vialId !== vial.id) return;
        var k = side + '|' + pick.label;
        if (seen[k]) return;
        seen[k] = true;
        out.push({ side: side, label: pick.label, sex: pick.sex, p: pick.p, n: pick.n });
      });
    });
    return out;
  }

  /* When each cross gets set up, if the first one goes in on `start` and a
     generation takes `days`. A cross waits for whichever parent is ready last,
     so a scheme that branches is as long as its longest arm, not as long as the
     list of steps. */
  function dateFor(start, days, generation) {
    if (!start) return null;
    var d = new Date(start + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + generation * days);
    return d;
  }

  function dayName(d) {
    if (!d) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function parseDay(text) {
    if (!text) return null;
    var d = new Date(String(text) + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  function addDays(d, n) {
    var out = new Date(d.getTime());
    out.setDate(out.getDate() + n);
    return out;
  }

  function isoDay(d) {
    if (!d) return '';
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')].join('-');
  }

  /* When each cross goes in. A cross with no cross behind it starts on the start
     date; anything else follows its last-ready parent by one generation. Any
     cross can be given a date of its own instead - `meta.setUpOn` - and
     everything downstream of it moves with it. That is what makes two schemes
     running side by side work: they are simply crosses whose parents are ready
     at different times, not a queue. */
  function schedule(vials, opts) {
    opts = opts || {};
    var days = opts.days || 14;
    var byId = {}, date = {}, gen = {}, busy = {};
    vials.forEach(function (v) { byId[v.id] = v; });

    function parentsOf(v) {
      var from = (v.meta && v.meta.from) || {};
      return ['mother', 'father'].map(function (side) {
        var pick = from[side];
        var p = pick && byId[pick.vialId];
        return (p && p.meta && p.meta.kind === 'cross') ? p : null;
      }).filter(Boolean);
    }

    function walk(v) {
      if (date[v.id] !== undefined) return;
      if (busy[v.id]) { date[v.id] = null; gen[v.id] = 1; return; }   /* never, but be safe */
      busy[v.id] = true;
      var parents = parentsOf(v);
      var latest = null, deepest = 0;
      parents.forEach(function (p) {
        walk(p);
        deepest = Math.max(deepest, gen[p.id] || 1);
        if (date[p.id] && (!latest || date[p.id] > latest)) latest = date[p.id];
      });
      gen[v.id] = parents.length ? deepest + 1 : 1;
      var own = parseDay(v.meta && v.meta.setUpOn);
      date[v.id] = own || (latest ? addDays(latest, days) : parseDay(opts.start));
      busy[v.id] = false;
    }

    vials.forEach(function (v) {
      if (v.meta && v.meta.kind === 'cross') walk(v);
    });
    return { date: date, gen: gen };
  }

  function stepFrom(v, vials, stepOf, sched, i) {
    var from = v.meta.from || {};
    function side(pick) {
      if (!pick) return null;
      var out = {};
      Object.keys(pick).forEach(function (k) { out[k] = pick[k]; });
      out.step = stepOf[pick.vialId] || null;   /* null = a stock, not an earlier cross */
      return out;
    }
    var when = sched.date[v.id] || null;
    return {
      n: i + 1,
      id: v.id,
      name: v.name,
      generation: sched.gen[v.id] || 1,
      date: when,
      dateText: dayName(when),
      dateValue: isoDay(when),
      fixed: !!(v.meta && v.meta.setUpOn),
      mother: { genotype: v.meta.motherText, from: side(from.mother) },
      father: { genotype: v.meta.fatherText, from: side(from.father) },
      kept: keptFrom(v, vials),
      notes: (v.meta.result && v.meta.result.notes) || [],
      classes: (v.meta.classes || []).slice()
    };
  }

  /* The crosses behind one vial. */
  function steps(vialId, vials, opts) {
    var list = chain(vialId, vials);
    var sched = schedule(vials, opts || {});
    var stepOf = {};
    list.forEach(function (v, i) { stepOf[v.id] = i + 1; });
    return list.map(function (v, i) { return stepFrom(v, vials, stepOf, sched, i); });
  }

  /* Every cross on the bench, in the order they are set up: the plan rather than
     one thread through it. Schemes that share nothing simply sit side by side,
     and a cross that draws on an older vial is dated from that vial. */
  function plan(vials, opts) {
    var sched = schedule(vials, opts || {});
    var crosses = vials.filter(function (v) { return v.meta && v.meta.kind === 'cross'; });
    crosses.sort(function (a, b) {
      var da = sched.date[a.id], db = sched.date[b.id];
      if (da && db && da.getTime() !== db.getTime()) return da - db;
      return (sched.gen[a.id] || 1) - (sched.gen[b.id] || 1);
    });
    var stepOf = {};
    crosses.forEach(function (v, i) { stepOf[v.id] = i + 1; });
    return crosses.map(function (v, i) { return stepFrom(v, vials, stepOf, sched, i); });
  }

  /* Where a parent came from. A step number rather than a vial name when it came
     out of an earlier cross, so a scheme that branches still reads in order. */
  function sourceLine(pick) {
    if (!pick || !pick.fromName) return 'a stock';
    var where = pick.step ? 'step ' + pick.step + ' (' + pick.fromName + ')' : pick.fromName;
    if (pick.p === null || pick.p === undefined) return 'from ' + where;
    return 'from ' + where + ', the ' + pick.label + ' class — ' + pct(pick.p) + oneIn(pick.p);
  }

  /* The shape of the scheme, for editors that draw Mermaid: which crosses feed
     which. A list cannot show two crosses feeding a third; this can. */
  function toMermaid(list) {
    if (!list.length) return '';
    var lines = ['```mermaid', 'flowchart TD'];
    var stocks = 0;
    list.forEach(function (s) {
      lines.push('  S' + s.n + '["Step ' + s.n + ': ' + safe(s.name) + '<br/>'
        + safe(s.mother.genotype) + '  ×  ' + safe(s.father.genotype) + '"]');
      ['mother', 'father'].forEach(function (which) {
        var from = s[which].from;
        if (from && from.step) {
          lines.push('  S' + from.step + ' -->|' + safe(trim(from.label))
            + (from.p ? ' ' + pct(from.p) : '') + '| S' + s.n);
        } else {
          stocks++;
          var id = 'K' + stocks;
          lines.push('  ' + id + '(["' + safe(s[which].genotype) + '"])');
          lines.push('  ' + id + ' --> S' + s.n);
        }
      });
    });
    lines.push('```');
    return lines.join('\n');
  }

  function trim(text) {
    var t = String(text || '');
    return t.length > 28 ? t.slice(0, 27) + '…' : t;
  }

  /* Mermaid labels are quoted strings: a quote or a bracket in a genotype would
     end the node early. */
  function safe(text) {
    return String(text || '').replace(/"/g, '″').replace(/[\[\]{}]/g, '').replace(/;/g, '&#59;');
  }

  /* A scheme you can paste into a notebook or hand to whoever runs the cross. */
  function toMarkdown(vialId, vials, opts) {
    opts = opts || {};
    var list = vialId ? steps(vialId, vials, opts) : plan(vials, opts);
    var last = null;
    vials.forEach(function (v) { if (v.id === vialId) last = v; });
    var title = opts.title || (vialId
      ? 'Crossing scheme' + (last ? ' — ' + last.name : '')
      : 'Crossing plan');
    var lines = ['# ' + title, ''];
    if (opts.date) lines.push('*' + opts.date + '*', '');

    if (!list.length) {
      lines.push('Nothing has been crossed into this vial yet.');
      return lines.join('\n');
    }

    if (opts.diagram !== false) lines.push(toMermaid(list), '');

    if (list.length && list[0].date) {
      var first = list[0].date, end = first, deepest = 1;
      list.forEach(function (st) {
        if (st.date && st.date > end) end = st.date;
        deepest = Math.max(deepest, st.generation || 1);
      });
      lines.push('First cross ' + dayName(first) + ', a generation taken as ' + (opts.days || 14)
        + ' days' + (opts.temperature ? ' at ' + opts.temperature + ' °C' : '') + '. '
        + list.length + ' cross' + (list.length === 1 ? '' : 'es') + ' over '
        + deepest + ' generation' + (deepest === 1 ? '' : 's') + '; the last goes in about '
        + dayName(end) + '.', '');
    }

    list.forEach(function (s) {
      lines.push('## Step ' + s.n + ' — ' + s.name
        + (s.dateText ? ' — set up ' + s.dateText : ''), '');
      lines.push('| | Genotype | Where it came from |');
      lines.push('| --- | --- | --- |');
      lines.push('| mothers | `' + s.mother.genotype + '` | ' + sourceLine(s.mother.from) + ' |');
      lines.push('| fathers | `' + s.father.genotype + '` | ' + sourceLine(s.father.from) + ' |');
      lines.push('');
      if (s.kept.length) {
        s.kept.forEach(function (k) {
          lines.push('- Keep the ' + (k.sex === 'F' ? 'virgin females' : 'males') + ' that are **'
            + k.label + '**' + (k.p ? ' — ' + pct(k.p) + ' of the vial' + oneIn(k.p) : '') + '.');
        });
        lines.push('');
      }
      s.notes.forEach(function (t) { lines.push('- ' + t); });
      if (s.notes.length) lines.push('');
    });

    var end = list[list.length - 1];
    if (end.classes.length) {
      lines.push('## What comes out of the last cross', '');
      lines.push('| | Phenotype | Expected |');
      lines.push('| --- | --- | --- |');
      end.classes.forEach(function (c) {
        lines.push('| ' + (c.sex === 'F' ? 'female' : 'male') + ' | ' + c.label + ' | ' + pct(c.p) + oneIn(c.p) + ' |');
      });
      lines.push('');
    }

    lines.push('Mothers must be virgins: collect females within eight hours of eclosion.');
    lines.push('');
    lines.push('*Frequencies are of the flies that survive to be scored, from the exact');
    lines.push('gamete enumeration rather than a sample.*');
    return lines.join('\n');
  }

  FCS.scheme = {
    chain: chain, steps: steps, plan: plan, schedule: schedule,
    toMarkdown: toMarkdown, keptFrom: keptFrom, toMermaid: toMermaid,
    dateFor: dateFor, dayName: dayName, isoDay: isoDay
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
