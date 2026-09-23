/* Fly Cross Planner - the fly, assembled from the FlyLab drawings.
 *
 * The drawings in flylab_images are a mixture of whole flies and isolated
 * parts. art/build_art.py turns them into a kit: a wingless body in each body
 * colour and sex, a head capsule, an eye layer, a thorax with its bristles, and
 * a wing. This file stacks them, so any combination of traits can be drawn.
 *
 *   FCS.flyart.sprite(key, { sex, traits }, onReady)  -> a 180x180 canvas, or null
 *   FCS.flyart.element({ sex, traits }, 140)          -> a canvas for the panel
 *   FCS.flyart.icon('eyeColor', 'white')              -> a path to a trait picture
 *
 * Exports FCS.flyart — sprite, SIZE_W, SIZE_H, tune
 * Needs FCS.data and the sprite kit in art/.
 */
(function (root) {
  'use strict';
  var FCS = root.FCS = root.FCS || {};
  var ART = 'art/';
  /* The sprite canvas is taller and a little wider than the body drawing, so a
     full-length wing has room. The body is drawn inset by ORIGIN_X. */
  var SIZE_W = 200, SIZE_H = 212, ORIGIN_X = 10;

  /* How far down the wing is scaled for each wing size. */
  var WING_SCALE = { normal: 1, miniature: 0.6, vestigial: 0.22, apterous: 0 };
  var MALE_SCALE = 0.9;
  var TUBBY = { x: 1.18, y: 0.78 };

  function has(traitId, value) { return FCS.data.isDrawn(traitId, value); }

  function drawn(traitId, value, fallback) {
    return has(traitId, value) ? value : fallback;
  }

  var images = {};      /* src -> { img, ready } */
  var sprites = {};     /* key -> canvas */
  var waiting = {};     /* key -> [callbacks] */

  function image(src) {
    if (images[src]) return images[src];
    var rec = { img: new root.Image(), ready: false, failed: false };
    rec.img.onload = function () { rec.ready = true; flush(); };
    rec.img.onerror = function () { rec.failed = true; flush(); };
    rec.img.src = ART + src + '.png';
    images[src] = rec;
    return rec;
  }

  /* Where each part sits, tuned against the original whole-fly drawing. The
   * wing is placed by its root -- the narrow point at the top of the wing
   * drawing, at (39.5, 6) in its own pixels -- so it meets the thorax instead
   * of floating beside it. */
  var HEAD = { scale: 0.40, eyeX: 89.5, eyeY: 29, partEyeX: 59.5, partEyeY: 54 };
  var THORAX = { scale: 0.60, x: 55, y: 30 };
  var WING = { scale: 0.80, rootX: 39.5, rootY: 6, left: 86, right: 94, y: 60, partW: 120 };

  /* The stack, bottom to top. */
  function layers(opts) {
    var t = opts.traits || {};
    var sex = opts.sex === 'M' ? 'M' : 'F';
    var body = drawn('bodyColor', t.bodyColor || 'wild', 'wild');
    var shape = drawn('eyeShape', t.eyeShape || 'round', 'round');
    var eyeColour = drawn('eyeColor', t.eyeColor || 'red', 'red');
    var bristles = drawn('bristles', t.bristles || 'normal', 'normal');
    var wingShape = drawn('wingShape', t.wingShape || 'normal', 'normal');
    var size = drawn('wingSize', t.wingSize || 'normal', 'normal');
    var ws = WING_SCALE[size] === undefined ? 1 : WING_SCALE[size];

    var hx = ORIGIN_X + HEAD.eyeX - HEAD.partEyeX * HEAD.scale;
    var hy = HEAD.eyeY - HEAD.partEyeY * HEAD.scale;

    var out = [
      { src: 'body_' + sex + '_' + body, scale: 1, x: ORIGIN_X, y: 0 },
      { src: 'thorax_' + bristles + '_' + body, scale: THORAX.scale, x: ORIGIN_X + THORAX.x, y: THORAX.y },
      { src: 'headcap_' + shape + '_' + body, scale: HEAD.scale, x: hx, y: hy }
    ];
    if (shape !== 'eyeless') {
      out.push({ src: 'eyes_' + shape + '_' + eyeColour, scale: HEAD.scale, x: hx, y: hy });
    }
    /* Hu adds bristles rather than changing the ones already there, so it is a
       layer of its own and shows alongside Sb. */
    if (t.humeral === 'extra') {
      out.splice(2, 0, { src: 'humeral_' + body, scale: THORAX.scale, x: ORIGIN_X + THORAX.x, y: THORAX.y });
    }
    if (ws > 0) {
      var s = WING.scale * ws;
      var top = WING.y - WING.rootY * s;
      var right = ORIGIN_X + WING.right;
      var left = ORIGIN_X + WING.left;
      out.push({ src: 'wing_' + wingShape, scale: s, x: right - WING.rootX * s, y: top });
      out.push({ src: 'wing_' + wingShape, scale: s, x: left - WING.rootX * s, y: top, flip: true, flipAbout: left });
    }
    return out;
  }

  function build(key, opts) {
    var ls = layers(opts), i, rec, allReady = true;
    for (i = 0; i < ls.length; i++) {
      rec = image(ls[i].src);
      if (!rec.ready && !rec.failed) allReady = false;
    }
    if (!allReady) return null;

    var cv = root.document.createElement('canvas');
    cv.width = SIZE_W; cv.height = SIZE_H;
    var c = cv.getContext('2d');
    var t = opts.traits || {};
    var cx = SIZE_W / 2, cy = SIZE_H / 2;
    if (opts.sex === 'M') {
      /* Males really are the smaller sex. */
      c.translate(cx, cy);
      c.scale(MALE_SCALE, MALE_SCALE);
      c.translate(-cx, -cy);
    }
    if (t.shape === 'tubby') {
      /* Tb: short and fat. Squashing the whole assembled fly keeps every part
         registered, and is what the marker looks like. */
      c.translate(cx, cy);
      c.scale(TUBBY.x, TUBBY.y);
      c.translate(-cx, -cy);
    }
    ls.forEach(function (l) {
      var r = images[l.src];
      if (!r || !r.ready) return;
      var w = r.img.naturalWidth * l.scale, h = r.img.naturalHeight * l.scale;
      c.save();
      if (l.flip) {
        /* Mirror about the wing hinge so the flipped wing keeps its root. */
        c.translate(l.flipAbout, 0);
        c.scale(-1, 1);
        c.drawImage(r.img, l.x - l.flipAbout, l.y, w, h);
      } else {
        c.drawImage(r.img, l.x, l.y, w, h);
      }
      c.restore();
    });
    sprites[key] = cv;
    return cv;
  }

  function flush() {
    var pending = Object.keys(waiting);
    pending.forEach(function (key) {
      var entry = waiting[key];
      var cv = build(key, entry.opts);
      if (cv) {
        delete waiting[key];
        entry.callbacks.forEach(function (fn) { fn(cv); });
      }
    });
  }

  /* A cached 180x180 canvas for this phenotype, or null while the parts load.
   * onReady is called once it is ready. */
  function sprite(key, opts, onReady) {
    if (sprites[key]) return sprites[key];
    var cv = build(key, opts);
    if (cv) return cv;
    if (!waiting[key]) waiting[key] = { opts: opts, callbacks: [] };
    if (onReady) waiting[key].callbacks.push(onReady);
    return null;
  }

  /* A canvas element sized for a panel, which fills itself in when ready. */
  function element(opts, px) {
    var cv = root.document.createElement('canvas');
    var h = px || 150, w = Math.round(h * SIZE_W / SIZE_H);
    cv.width = w; cv.height = h;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    var c = cv.getContext('2d');
    var key = 'el' + JSON.stringify(layers(opts));
    function paint(src) { c.clearRect(0, 0, w, h); c.drawImage(src, 0, 0, w, h); }
    var ready = sprite(key, opts, paint);
    if (ready) paint(ready);
    return cv;
  }

  function icon(traitId, value) {
    return ART + 'icon_' + traitId + '_' + value + '.png';
  }

  function preload() {
    ['body_F_wild', 'body_M_wild', 'thorax_normal_wild', 'headcap_round_wild',
      'eyes_round_red', 'wing_normal'].forEach(image);
  }

  /* Nudge the part positions and clear the cache. Handy when retuning the
     assembly against a photograph. */
  function tune(patch) {
    if (patch.head) Object.keys(patch.head).forEach(function (k) { HEAD[k] = patch.head[k]; });
    if (patch.thorax) Object.keys(patch.thorax).forEach(function (k) { THORAX[k] = patch.thorax[k]; });
    if (patch.wing) Object.keys(patch.wing).forEach(function (k) { WING[k] = patch.wing[k]; });
    if (patch.maleScale !== undefined) MALE_SCALE = patch.maleScale;
    if (patch.tubby) { TUBBY.x = patch.tubby.x; TUBBY.y = patch.tubby.y; }
    sprites = {};
  }

  FCS.flyart = { sprite: sprite, element: element, icon: icon, layers: layers, preload: preload, tune: tune, has: has, SIZE_W: SIZE_W, SIZE_H: SIZE_H };
})(typeof globalThis !== 'undefined' ? globalThis : this);
