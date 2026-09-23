/* Fly Cross Planner - building a genotype by slots rather than by typing.
 *
 * A row per chromosome, two homologue slots each. Because the slot is the
 * chromosome and the contents are picked rather than typed, three things
 * become impossible: putting a gene on the wrong chromosome, misspelling it,
 * and being unclear which homologue is which. Dragging a chip from one slot to
 * the other is the one gesture that means something - cis versus trans.
 *
 * Exports FCS.targetBuilder — init, toText, setFromText, clear (PARKED)
 * Needs FCS.data, FCS.parse, FCS.planner, FCS.inspector.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};
  var CHRS = ['X', '2', '3', '4'];
  var esc, host, onChange, openPicker = null, note = '';

  var model = null;

  function blank() {
    var m = {};
    CHRS.forEach(function (id) {
      m[id] = [{ balancer: null, alleles: [] }, { balancer: null, alleles: [] }];
    });
    return m;
  }

  function sideEmpty(side) { return !side.balancer && !side.alleles.length; }
  function chrEmpty(id) { return sideEmpty(model[id][0]) && sideEmpty(model[id][1]); }

  function sideText(side) {
    if (side.balancer) {
      var extra = side.alleles.map(symbolOf);
      return extra.length ? side.balancer + ',' + extra.join(',') : side.balancer;
    }
    if (!side.alleles.length) return '+';
    return side.alleles.map(symbolOf).join(',');
  }

  function symbolOf(id) {
    var a = FCS.data.alleles[id];
    return a ? a.symbol : id;
  }

  /* Emit every chromosome up to the last one with something on it, so position
     still lines up for anything the library cannot place by itself. */
  function toText() {
    var last = -1;
    CHRS.forEach(function (id, i) { if (!chrEmpty(id)) last = i; });
    if (last < 0) return '';
    var parts = [];
    for (var i = 0; i <= last; i++) {
      var id = CHRS[i];
      parts.push(chrEmpty(id) ? '+' : sideText(model[id][0]) + '/' + sideText(model[id][1]));
    }
    return parts.join('; ');
  }

  function fromFly(fly) {
    var m = blank();
    CHRS.forEach(function (id) {
      [0, 1].forEach(function (i) {
        var h = fly.chrs[id][i];
        if (!h || h.chr === 'Y') return;
        var side = m[id][i];
        side.balancer = h.balancer || null;
        var skip = {};
        if (h.balancer && FCS.data.balancers[h.balancer]) {
          FCS.data.balancers[h.balancer].markers.forEach(function (aid) {
            var al = FCS.data.alleles[aid];
            if (al) skip[al.gene] = true;
          });
        }
        Object.keys(h.alleles).forEach(function (gene) {
          if (!skip[gene]) side.alleles.push(h.alleles[gene]);
        });
      });
    });
    model = m;
  }

  function setFromText(text) {
    var parsed = FCS.parse.parse(text || '', 'F');
    fromFly(parsed.fly);
    render();
    return parsed;
  }

  /* ---------- picking what goes in a slot ---------- */

  function pickerFor(chrId, sideIndex) {
    var balancers = Object.keys(FCS.data.balancers).filter(function (id) {
      return FCS.data.balancers[id].chr === chrId;
    });
    var markers = Object.keys(FCS.data.alleles).filter(function (id) {
      var a = FCS.data.alleles[id];
      return !a.unknown && FCS.data.genes[a.gene] && FCS.data.genes[a.gene].chr === chrId;
    });
    return '<div class="picker" data-chr="' + chrId + '" data-side="' + sideIndex + '">'
      + '<div class="picker-row"><span class="picker-label">Balancer</span>'
      + balancers.map(function (id) {
        return '<button class="chip" data-put="bal:' + esc(id) + '">' + esc(id) + '</button>';
      }).join('') + '</div>'
      + '<div class="picker-row"><span class="picker-label">Marker</span>'
      + markers.map(function (id) {
        return '<button class="chip" data-put="' + esc(id) + '">' + esc(symbolOf(id)) + '</button>';
      }).join('') + '</div>'
      + '<div class="picker-row"><span class="picker-label">Any allele</span>'
      + '<input class="picker-find" type="search" placeholder="type any name: cnn, ana2, myGene-GFP…" autocomplete="off">'
      + '</div><div class="picker-hits"></div>'
      + (note ? '<p class="hint">' + esc(note) + '</p>' : '')
      + '<p class="hint">Anything you type is carried on this chromosome as an invisible marker, '
      + 'whether or not it is in a stock list.</p>'
      + '<div class="picker-row"><button class="link-btn" data-put="wild">leave it wild type</button>'
      + '<button class="link-btn" data-close="1">close</button></div>'
      + '</div>';
  }

  function render() {
    var rows = CHRS.map(function (id) {
      if (id === '4' && chrEmpty('4')) return '';
      return '<div class="chr-row" data-chr="' + id + '">'
        + '<span class="chr-label">' + id + '</span>'
        + slotHtml(id, 0) + '<span class="slash">/</span>' + slotHtml(id, 1)
        + '</div>';
    }).join('');
    host.innerHTML = rows
      + (chrEmpty('4') ? '<button class="link-btn" id="showChr4">add chromosome 4</button>' : '')
      + '<div id="pickerHost"></div>';
    if (openPicker) {
      document.getElementById('pickerHost').innerHTML = pickerFor(openPicker.chr, openPicker.side);
    }
  }

  function slotHtml(chrId, i) {
    var side = model[chrId][i];
    var chips = '';
    if (side.balancer) {
      chips += '<span class="gchip bal" draggable="true" data-from="' + chrId + '|' + i + '|bal">'
        + esc(side.balancer) + '<button data-del="' + chrId + '|' + i + '|bal">&times;</button></span>';
    }
    side.alleles.forEach(function (aid, k) {
      chips += '<span class="gchip" draggable="true" data-from="' + chrId + '|' + i + '|' + k + '">'
        + esc(symbolOf(aid)) + '<button data-del="' + chrId + '|' + i + '|' + k + '">&times;</button></span>';
    });
    if (!chips) chips = '<span class="gchip wild">+</span>';
    return '<div class="hslot" data-slot="' + chrId + '|' + i + '">' + chips
      + '<button class="slot-add" data-open="' + chrId + '|' + i + '">add</button></div>';
  }

  /* ---------- editing ---------- */

  function put(chrId, i, what) {
    var side = model[chrId][i];
    note = '';
    if (what === 'wild') { side.balancer = null; side.alleles = []; }
    else if (what.indexOf('bal:') === 0) { side.balancer = what.slice(4); }
    else if (what.indexOf('new:') === 0) {
      var id = typed(what.slice(4), chrId);
      if (id && side.alleles.indexOf(id) < 0) side.alleles.push(id);
    }
    else if (side.alleles.indexOf(what) < 0) { side.alleles.push(what); }
    changed();
  }

  /* A name typed by hand. If the library or a stock list already knows it, use
     that one - but only if it belongs on this chromosome, because a gene cannot
     move. Otherwise register it here as an invisible marker on this
     chromosome, which is what an untagged allele or a transgene is at the
     bench: something you cannot see, kept over a balancer. */
  function typed(symbol, chrId) {
    var sym = String(symbol || '').trim();
    if (!sym) return null;
    var known = FCS.parse.lookupAllele(sym);
    if (known) {
      var gene = FCS.data.genes[FCS.data.alleles[known].gene];
      if (gene && gene.chr === chrId) return known;
      note = FCS.data.alleles[known].symbol + ' is on chromosome ' + (gene ? gene.chr : '?')
        + ', so it cannot go in a chromosome ' + chrId + ' slot.';
      return null;
    }
    return FCS.data.ensureAllele(sym, chrId);
  }

  function remove(chrId, i, which) {
    var side = model[chrId][i];
    if (which === 'bal') side.balancer = null;
    else side.alleles.splice(parseInt(which, 10), 1);
    changed();
  }

  function move(from, toChr, toSide) {
    var bits = from.split('|');
    if (bits[0] !== toChr) return;                 /* a gene cannot change chromosome */
    var src = model[bits[0]][parseInt(bits[1], 10)];
    var dst = model[toChr][toSide];
    if (bits[2] === 'bal') {
      if (!src.balancer) return;
      dst.balancer = src.balancer; src.balancer = null;
    } else {
      var aid = src.alleles.splice(parseInt(bits[2], 10), 1)[0];
      if (aid && dst.alleles.indexOf(aid) < 0) dst.alleles.push(aid);
    }
    changed();
  }

  function changed() {
    render();
    if (onChange) onChange(toText());
  }

  function findAlleles(input, hits) {
    var q = input.value.trim();
    if (!q) { hits.innerHTML = ''; return; }
    var list = q.length > 1 ? FCS.planner.spellingsLike(q, 12) : [];
    var exact = list.some(function (r) { return r.symbol === q; });
    var own = exact ? '' : '<button class="chip own" data-put="new:' + esc(q) + '">use <b>'
      + esc(q) + '</b> <span class="dim">as typed</span></button>';
    var found = list.map(function (r) {
      return '<button class="chip" data-put="new:' + esc(r.symbol) + '">' + esc(r.symbol)
        + ' <span class="dim">' + r.held + '</span></button>';
    }).join('');
    /* Spellings the stock list actually uses come first, because most of the
       time one of them is what you meant. The name as typed is always there
       after them, so a gene nobody has a stock for is never a dead end. */
    hits.innerHTML = found + own
      + (found ? '' : '<span class="dim">not in the stock list \u2014 use it anyway, or press Enter</span>');
  }

  function init(el, cb) {
    esc = FCS.inspector.esc;
    host = el;
    onChange = cb;
    model = blank();
    render();

    host.addEventListener('click', function (ev) {
      var open = ev.target.closest('[data-open]');
      if (open) {
        var b = open.getAttribute('data-open').split('|');
        openPicker = { chr: b[0], side: parseInt(b[1], 10) };
        render();
        return;
      }
      var del = ev.target.closest('[data-del]');
      if (del) {
        var d = del.getAttribute('data-del').split('|');
        remove(d[0], parseInt(d[1], 10), d[2]);
        return;
      }
      var putBtn = ev.target.closest('[data-put]');
      if (putBtn && openPicker) {
        put(openPicker.chr, openPicker.side, putBtn.getAttribute('data-put'));
        return;
      }
      if (ev.target.closest('[data-close]')) { openPicker = null; render(); return; }
      if (ev.target.id === 'showChr4') {
        model['4'][0].alleles = []; openPicker = { chr: '4', side: 0 }; render();
      }
    });

    host.addEventListener('input', function (ev) {
      if (!ev.target.classList.contains('picker-find')) return;
      findAlleles(ev.target, host.querySelector('.picker-hits'));
    });

    host.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || !ev.target.classList.contains('picker-find')) return;
      ev.preventDefault();
      if (openPicker && ev.target.value.trim()) {
        put(openPicker.chr, openPicker.side, 'new:' + ev.target.value.trim());
      }
    });

    host.addEventListener('dragstart', function (ev) {
      var chip = ev.target.closest('[data-from]');
      if (!chip) return;
      ev.dataTransfer.setData('text/plain', chip.getAttribute('data-from'));
      ev.dataTransfer.effectAllowed = 'move';
    });
    host.addEventListener('dragover', function (ev) {
      if (ev.target.closest('[data-slot]')) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; }
    });
    host.addEventListener('drop', function (ev) {
      var slot = ev.target.closest('[data-slot]');
      if (!slot) return;
      ev.preventDefault();
      var to = slot.getAttribute('data-slot').split('|');
      move(ev.dataTransfer.getData('text/plain'), to[0], parseInt(to[1], 10));
    });
  }

  FCS.targetBuilder = { init: init, toText: toText, setFromText: setFromText, clear: function () { model = blank(); render(); } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
