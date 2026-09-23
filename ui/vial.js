/* Fly Cross Planner - the vial: flies that move, a CO2 pad, and clicking to sort.  *
 * Exports FCS.VialView — a constructor: setFlies, anaesthetise, setGrouping, start,
 *   stop, draw, hitTest, and the onPick callback
 * Needs FCS.flyart, FCS.genetics, and FCS.parse (only to decide which half of
 *   a genotype heading is a gene of the user's own).
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};

  function VialView(canvas) {
    var self = this;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.agents = [];
    this.asleep = false;
    this.groupBy = 'none';   /* 'none' | 'phenotype' | 'genotype' */
    this.running = false;
    this.onPick = null;
    this.hover = -1;

    canvas.addEventListener('click', function (ev) {
      var i = self.hitTest(ev);
      if (i >= 0 && self.onPick) self.onPick(i, ev);
    });
    canvas.addEventListener('mousemove', function (ev) {
      var i = self.hitTest(ev);
      if (i !== self.hover) { self.hover = i; canvas.style.cursor = i >= 0 ? 'pointer' : 'default'; }
    });
  }

  VialView.prototype.size = function () {
    var r = this.canvas.getBoundingClientRect();
    var dpr = root.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(r.width * dpr) || this.canvas.height !== Math.round(r.height * dpr)) {
      this.canvas.width = Math.round(r.width * dpr);
      this.canvas.height = Math.round(r.height * dpr);
    }
    this.w = r.width; this.h = r.height; this.dpr = dpr;
  };

  VialView.prototype.spriteFor = function (ph) {
    var self = this;
    return FCS.flyart.sprite(ph.key, { sex: ph.sex, traits: ph.traits }, function () {
      self.draw();
    });
  };

  VialView.prototype.setFlies = function (flies) {
    if (!this.asleep || this.groupBy === 'none') this.shrinkBack();
    this.size();
    var w = this.w || 400, h = this.h || 300;
    this.slotOrder = null;
    this.agents = flies.map(function (f, i) {
      return {
        ref: f,
        x: 30 + Math.random() * (w - 60),
        y: 30 + Math.random() * (h - 60),
        dir: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.7,
        mode: 'walk',
        t: Math.random() * 120,
        bob: Math.random() * Math.PI * 2,
        idx: i
      };
    });
    this.layoutIfAsleep();
  };

  VialView.prototype.layoutIfAsleep = function () {
    if (!this.asleep) return;
    if (this.groupBy !== 'none') return this.layoutGrouped();

    var w = this.w || 400, h = this.h || 300, n = this.agents.length;
    var pad = 24, sp = 54, cols = 1, rows = 1;
    /* Shrink the spacing until every fly in the vial is on the pad. Sorting
       flies you cannot see is not sorting. */
    for (sp = 54; sp >= 26; sp -= 2) {
      cols = Math.max(1, Math.floor((w - 2 * pad) / sp));
      rows = Math.ceil(n / cols);
      if (pad + rows * sp * 1.14 <= h) break;
    }
    this.padSpacing = sp;
    this.groupLabels = null;

    /* Flies land on the pad in no particular order, which is the whole point
       of having to sort them. Shuffle the slots, but keep them stable while
       the vial stays open. */
    if (!this.slotOrder || this.slotOrder.length !== n) {
      this.slotOrder = this.agents.map(function (_, i) { return i; });
      for (var i = this.slotOrder.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = this.slotOrder[i]; this.slotOrder[i] = this.slotOrder[j]; this.slotOrder[j] = t;
      }
    }
    var order = this.slotOrder;
    this.agents.forEach(function (a, i) {
      var slot = order[i];
      a.targetX = pad + (slot % cols) * sp + sp / 2;
      a.targetY = pad + Math.floor(slot / cols) * sp * 1.14;
      a.targetDir = -0.15 + Math.random() * 0.3;
    });
  };

  /* Pushing the flies into piles the way you would with a brush. Off by default:
     doing the sorting for you takes away the exercise, but once you know what
     you are looking at, counting piles is the job.
     By phenotype is what you could really do. By genotype is the X-ray view:
     the piles you cannot tell apart down the microscope, which is exactly why
     the cross needs another generation. */
  VialView.prototype.layoutGrouped = function () {
    var self = this;
    /* Measure against the pad's own height, never the height the last vial
       left behind. Without this the pad only ever grows: a cross with fewer
       classes than the one before it would keep the taller page, and you would
       scroll through empty squares to reach the bench. */
    this.shrinkBack();
    this.size();
    var w = this.w || 400, h = this.h || 300;
    var pad = 16, labelH = 14, gap = 8;

    var byGenotype = this.groupBy === 'genotype';
    var byKey = {}, groups = [];
    this.agents.forEach(function (a, i) {
      var ph = a.ref.phenotype;
      var key = byGenotype ? (FCS.genetics.genotypeString(a.ref.fly) + '|' + ph.sex) : ph.key;
      if (!byKey[key]) {
        byKey[key] = {
          key: key, sex: ph.sex, idx: [],
          label: byGenotype ? FCS.genetics.genotypeString(a.ref.fly) : ph.label,
          under: byGenotype ? ph.label : null
        };
        groups.push(byKey[key]);
      }
      byKey[key].idx.push(i);
    });
    /* Females first, the way you sort them: virgins are the ones on the clock. */
    groups.sort(function (a, b) {
      if (a.sex !== b.sex) return a.sex === 'F' ? -1 : 1;
      if (b.idx.length !== a.idx.length) return b.idx.length - a.idx.length;
      return a.label < b.label ? -1 : 1;
    });

    /* Shrink a little to fit, but not past the point where a fly is a smudge.
       Beyond that the pad grows instead and the page scrolls: a pile you cannot
       see is a pile you cannot count, and cramming forty genotypes into one
       screen helps nobody. */
    var sp = 50, cols = 1, i, used;
    function heightAt(spacing) {
      var c = Math.max(1, Math.floor((w - 2 * pad) / spacing));
      var total = pad * 2;
      for (var k = 0; k < groups.length; k++) {
        total += labelH + Math.ceil(groups[k].idx.length / c) * spacing * 1.06 + gap;
      }
      return { cols: c, height: total };
    }
    for (sp = 50; sp >= 34; sp -= 2) {
      used = heightAt(sp);
      cols = used.cols;
      if (used.height <= h) break;
    }
    if (sp < 34) sp = 34;   /* the loop overshoots by one step on its way out */
    used = heightAt(sp);
    cols = used.cols;
    this.padSpacing = sp;

    this.grownTo = used.height > h ? Math.min(used.height, 6000) : 0;
    if (this.grownTo) {
      this.canvas.style.height = this.grownTo + 'px';
      this.size();
      h = this.h;
      used = heightAt(sp);
      cols = used.cols;
    }

    var y = pad;
    this.groupLabels = [];
    groups.forEach(function (g) {
      self.groupLabels.push({
        x: pad, y: y + labelH - 4, text: g.label, under: g.under,
        n: g.idx.length, sex: g.sex, mono: byGenotype
      });
      y += labelH;
      g.idx.forEach(function (agentIndex, j) {
        var a = self.agents[agentIndex];
        a.targetX = pad + (j % cols) * sp + sp / 2;
        a.targetY = y + Math.floor(j / cols) * sp * 1.06 + sp * 0.45;
        a.targetDir = -0.15 + Math.random() * 0.3;
      });
      y += Math.ceil(g.idx.length / cols) * sp * 1.06 + gap;
    });
  };

  VialView.prototype.setGrouping = function (how) {
    this.groupBy = how || 'none';
    this.slotOrder = null;
    if (this.groupBy === 'none') this.shrinkBack();
    this.layoutIfAsleep();
  };

  VialView.prototype.shrinkBack = function () {
    if (!this.grownTo) return;
    this.grownTo = 0;
    this.canvas.style.height = '';
    this.size();
  };

  VialView.prototype.anaesthetise = function (on) {
    this.asleep = !!on;
    if (!this.asleep) this.shrinkBack();
    this.layoutIfAsleep();
  };

  VialView.prototype.hitTest = function (ev) {
    var r = this.canvas.getBoundingClientRect();
    var x = ev.clientX - r.left, y = ev.clientY - r.top;
    var reach = this.asleep ? Math.max(14, (this.padSpacing || 44) * 0.5) : 24;
    var best = -1, bestD = reach * reach;
    this.agents.forEach(function (a, i) {
      var dx = a.x - x, dy = a.y - y, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  };

  VialView.prototype.step = function () {
    var w = this.w, h = this.h, i, a;
    for (i = 0; i < this.agents.length; i++) {
      a = this.agents[i];
      if (this.asleep) {
        if (a.targetX !== undefined) {
          a.x += (a.targetX - a.x) * 0.12;
          a.y += (a.targetY - a.y) * 0.12;
          var dd = a.targetDir - a.dir;
          while (dd > Math.PI) dd -= Math.PI * 2;
          while (dd < -Math.PI) dd += Math.PI * 2;
          a.dir += dd * 0.12;
        }
        continue;
      }
      a.t -= 1;
      if (a.t <= 0) {
        a.t = 40 + Math.random() * 160;
        var roll = Math.random();
        a.mode = roll < 0.35 ? 'rest' : (roll < 0.85 ? 'walk' : 'dash');
        a.dir += (Math.random() - 0.5) * 2.2;
        a.speed = a.mode === 'dash' ? 2.2 + Math.random() * 2 : 0.25 + Math.random() * 0.8;
      }
      if (a.mode !== 'rest') {
        a.dir += (Math.random() - 0.5) * 0.14;
        a.x += Math.cos(a.dir) * a.speed;
        a.y += Math.sin(a.dir) * a.speed;
        a.bob += 0.35;
      }
      if (a.x < 22) { a.x = 22; a.dir = Math.PI - a.dir + (Math.random() - 0.5) * 0.4; }
      if (a.x > w - 22) { a.x = w - 22; a.dir = Math.PI - a.dir + (Math.random() - 0.5) * 0.4; }
      if (a.y < 24) { a.y = 24; a.dir = -a.dir + (Math.random() - 0.5) * 0.4; }
      if (a.y > h - 24) { a.y = h - 24; a.dir = -a.dir + (Math.random() - 0.5) * 0.4; }
    }
  };

  VialView.prototype.draw = function () {
    this.size();
    var c = this.ctx, w = this.w, h = this.h;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, w, h);

    c.fillStyle = this.asleep ? '#eef3f6' : '#fbfaf7';
    c.fillRect(0, 0, w, h);
    if (this.asleep) {
      c.strokeStyle = '#cfdce4'; c.lineWidth = 1;
      for (var gx = 0; gx < w; gx += 24) { c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, h); c.stroke(); }
      for (var gy = 0; gy < h; gy += 24) { c.beginPath(); c.moveTo(0, gy); c.lineTo(w, gy); c.stroke(); }
    }

    var self = this;
    if (this.asleep && this.groupBy !== 'none' && this.groupLabels) {
      c.save();
      c.textAlign = 'left';
      var room = w - 16 - 16;
      function cut(text, max) {
        if (c.measureText(text).width <= max) return text;
        var out = text;
        while (out.length > 1 && c.measureText(out + '\u2026').width > max) out = out.slice(0, -1);
        return out + '\u2026';
      }
      /* Runs of text drawn left to right, each in its own colour, cut short
         together when they run out of room. Used so the gene you are following
         can be picked out of a heading the way it is everywhere else. */
      function drawRuns(runs, x, y, max) {
        var used = 0;
        for (var k = 0; k < runs.length; k++) {
          var t = runs[k].text, wide = c.measureText(t).width;
          c.fillStyle = runs[k].own ? '#28353e' : '#93a3ad';
          if (used + wide > max) {
            while (t.length > 1 && used + c.measureText(t + '\u2026').width > max) t = t.slice(0, -1);
            c.fillText(t + '\u2026', x + used, y);
            return max;
          }
          c.fillText(t, x + used, y);
          used += wide;
        }
        return used;
      }
      /* A written genotype split into the pieces that get their own colour. */
      function genoRuns(text) {
        var runs = [];
        String(text).split(';').forEach(function (seg, i) {
          if (i) runs.push({ text: ';', own: false });
          seg.split('/').forEach(function (side, j) {
            if (j) runs.push({ text: '/', own: false });
            runs.push({ text: side, own: FCS.parse.isYourSide(side) });
          });
        });
        return runs;
      }

      this.groupLabels.forEach(function (g) {
        c.font = g.mono ? '600 11px ui-monospace, Menlo, monospace' : '600 11px -apple-system, sans-serif';
        c.fillStyle = '#5b6b76';
        var at;
        if (g.mono) {
          /* Grouped by genotype: the heading is a genotype, so colour it. */
          var runs = [{ text: (g.sex === 'F' ? '\u2640 ' : '\u2642 '), own: false }]
            .concat(genoRuns(g.text))
            .concat([{ text: '  \u00d7' + g.n, own: false }]);
          at = drawRuns(runs, g.x, g.y, room) + 10;
        } else {
          var head = cut((g.sex === 'F' ? '\u2640 ' : '\u2642 ') + g.text + '  \u00d7' + g.n, room);
          c.fillText(head, g.x, g.y);
          at = c.measureText(head).width + 10;
        }
        if (g.under) {
          c.font = '11px -apple-system, sans-serif';
          c.fillStyle = '#9aa7b0';
          c.fillText(cut(g.under, room - at), g.x + at, g.y);
        }
        c.strokeStyle = '#d7e2ea'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(g.x, g.y + 3.5); c.lineTo(w - 16, g.y + 3.5); c.stroke();
      });
      c.restore();
    }
    this.agents.forEach(function (a, i) {
      var ph = a.ref.phenotype;
      var img = self.spriteFor(ph);
      var size = self.asleep ? Math.min(54, (self.padSpacing || 46) * 1.06) : 46;
      var sw = size * FCS.flyart.SIZE_W / FCS.flyart.SIZE_H;
      c.save();
      c.translate(a.x, a.y + (self.asleep ? 0 : Math.sin(a.bob) * 0.8));
      c.rotate(a.dir + Math.PI / 2);
      if (a.ref.selected) {
        c.beginPath();
        c.arc(0, 0, 21, 0, Math.PI * 2);
        c.fillStyle = 'rgba(46,125,190,0.18)';
        c.fill();
        c.strokeStyle = '#2e7dbe'; c.lineWidth = 2; c.stroke();
      } else if (i === self.hover) {
        c.beginPath(); c.arc(0, 0, 21, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1.5; c.stroke();
      }
      if (img) c.drawImage(img, -sw / 2, -size / 2, sw, size);
      c.restore();

      /* Markers with no drawing yet get their symbol written beside the fly,
         so they can still be sorted on. */
      if (ph.badges && ph.badges.length) {
        c.save();
        c.font = '600 10px -apple-system, sans-serif';
        c.textAlign = 'center';
        var text = ph.badges.join(' ');
        var tw = c.measureText(text).width;
        c.fillStyle = 'rgba(255,255,255,0.85)';
        c.fillRect(a.x - tw / 2 - 3, a.y + size / 2 - 9, tw + 6, 12);
        c.fillStyle = '#a8412a';
        c.fillText(text, a.x, a.y + size / 2);
        c.restore();
      }
    });
  };

  /* The loop is kept alive on purpose. A single exception inside step() or
     draw() used to end the requestAnimationFrame chain for good, and the page
     looked fine except that the flies had frozen. Now a bad frame is skipped and
     reported once, and a watchdog restarts the loop if it ever stops - a
     backgrounded tab, a page restored from the back/forward cache, or a frame
     that threw. */
  VialView.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.lastFrame = Date.now();
    var self = this;

    function loop() {
      if (!self.running) return;
      self.lastFrame = Date.now();
      try {
        self.step();
        self.draw();
      } catch (e) {
        self.reportFrameError(e);
      }
      root.requestAnimationFrame(loop);
    }
    root.requestAnimationFrame(loop);

    if (!this.watchdog) {
      this.watchdog = root.setInterval(function () {
        if (!self.running) return;
        if (Date.now() - (self.lastFrame || 0) < 2000) return;
        if (root.document && root.document.hidden) return;   /* a hidden tab is meant to be still */
        self.lastFrame = Date.now();
        root.requestAnimationFrame(loop);
      }, 2000);
    }

    if (!this.woken) {
      this.woken = true;
      ['visibilitychange', 'pageshow', 'focus'].forEach(function (ev) {
        var target = ev === 'visibilitychange' ? root.document : root;
        target.addEventListener(ev, function () {
          if (!self.running || (root.document && root.document.hidden)) return;
          self.lastFrame = Date.now();
          root.requestAnimationFrame(loop);
        });
      });
    }
  };

  VialView.prototype.reportFrameError = function (e) {
    this.frameErrors = (this.frameErrors || 0) + 1;
    if (this.frameErrors > 1) return;
    if (root.console && root.console.error) {
      root.console.error('[fly-cross-sim] a frame threw; the flies keep going. '
        + 'Please pass this on:', e && e.stack ? e.stack : e);
    }
  };

  VialView.prototype.stop = function () {
    this.running = false;
    if (this.watchdog) { root.clearInterval(this.watchdog); this.watchdog = null; }
  };

  FCS.VialView = VialView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
