/* Animated DNA double helix for the home hero.

   This is real 3D geometry rather than a drawn sine wave: base pairs are placed in
   cylindrical coordinates using B-DNA proportions (10.5 base pairs per turn, a 34.3 degree
   twist per pair, and the 140 degree strand offset that produces the major and minor
   grooves), rotated about the vertical axis, then projected through a perspective camera.
   Every strand segment, rung and node is depth sorted and drawn back to front, with colour
   fading toward the panel as it recedes. */
(function () {
  var canvas = document.getElementById("dna-canvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---- palette: the site greens, with two accents for the base pairs ---- */
  var PANEL = [247, 245, 240];   /* --bone */
  var BACKBONE = [18, 59, 51];    /* --forest */
  var AMBER = [222, 154, 58];     /* --amber, deepened so it holds on white */
  var TEAL = [31, 122, 104];      /* --green-link, opened up */

  /* A pairs with T, G pairs with C. Purines get the warm hue, pyrimidines the cool one. */
  var BASES = { A: AMBER, T: AMBER, G: TEAL, C: TEAL };
  var COMPLEMENT = { A: "T", T: "A", G: "C", C: "G" };

  /* ---- B-DNA geometry, in units where the helix radius is 1 ---- */
  var RADIUS = 1;
  var RISE = 0.335;                          /* vertical rise per base pair */
  var TWIST = (2 * Math.PI) / 10.5;          /* 10.5 base pairs per full turn */
  var STRAND_OFFSET = (140 * Math.PI) / 180; /* not 180: this is what carves the grooves */
  var TILT = -0.07;                          /* slight camera tilt, in radians */
  var FOV = 5.2;

  var w = 0, h = 0, dpr = 1, scale = 1, bpCount = 0;
  var sequence = [];
  var running = false, lastTime = 0, rotation = 0, drift = 0;

  /* A deterministic pseudo-random sequence, so the helix looks biological rather than
     patterned, but renders identically on every load. */
  function buildSequence(n) {
    var letters = ["A", "T", "G", "C"];
    var out = [];
    var seed = 0x2f6b1d;
    for (var i = 0; i < n; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      out.push(letters[(seed >> 16) % 4]);
    }
    return out;
  }

  function fog(rgb, depth, strength) {
    /* depth: 0 at the back of the helix, 1 at the front */
    var k = (0.24 + depth * 0.76) * (strength === undefined ? 1 : strength);
    return "rgb(" +
      Math.round(PANEL[0] + (rgb[0] - PANEL[0]) * k) + "," +
      Math.round(PANEL[1] + (rgb[1] - PANEL[1]) * k) + "," +
      Math.round(PANEL[2] + (rgb[2] - PANEL[2]) * k) + ")";
  }

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* the helix spans roughly half the panel width, capped so it stays elegant when wide */
    scale = Math.min(w * 0.185, 140);

    /* enough base pairs to overflow the panel top and bottom, so it reads as endless */
    bpCount = Math.ceil(h / scale / RISE) + 8;
    sequence = buildSequence(bpCount);

    if (!running) render(0);
  }

  /* project a point in helix space to the canvas */
  function project(angle, y, out) {
    var x = Math.cos(angle) * RADIUS;
    var z = Math.sin(angle) * RADIUS;

    /* tilt about the x axis so we look slightly down the helix */
    var cosT = Math.cos(TILT), sinT = Math.sin(TILT);
    var y2 = y * cosT - z * sinT;
    var z2 = y * sinT + z * cosT;

    var perspective = FOV / (FOV + z2);
    out.x = w / 2 + x * scale * perspective;
    out.y = h / 2 + y2 * scale * perspective;
    out.z = z2;
    out.p = perspective;
    out.depth = (z2 / RADIUS + 1) / 2;   /* 0 back, 1 front */
    return out;
  }

  var pa = {}, pb = {};

  function render(time) {
    if (lastTime) {
      var dt = Math.min(time - lastTime, 64);
      rotation += dt * 0.00042;   /* the helix turning on its axis */
      drift += dt * 0.00013;      /* base pairs travelling up through the frame */
    }
    lastTime = time;

    ctx.clearRect(0, 0, w, h);

    var half = bpCount / 2;
    var shift = drift % RISE;     /* wrap so the travel never jumps */
    var prims = [];

    /* Backbones, sampled between base pairs so the curve reads as a helix rather than a
       chain of straight facets. Each sub-segment is sorted on its own depth. */
    var SUB = 7;
    var total = (bpCount - 1) * SUB;

    for (var s = 0; s < total; s++) {
      var t0 = s / SUB;
      var t1 = (s + 1) / SUB;

      var y0 = (t0 - half) * RISE - shift;
      var y1 = (t1 - half) * RISE - shift;
      var g0 = t0 * TWIST + rotation;
      var g1 = t1 * TWIST + rotation;

      project(g0, y0, pa);
      var ax = pa.x, ay = pa.y, az = pa.z, ad = pa.depth, ap = pa.p;
      project(g1, y1, pb);
      prims.push({
        kind: "strand", z: (az + pb.z) / 2,
        x1: ax, y1: ay, x2: pb.x, y2: pb.y,
        d: (ad + pb.depth) / 2, p: (ap + pb.p) / 2
      });

      project(g0 + STRAND_OFFSET, y0, pa);
      var bx = pa.x, by = pa.y, bz = pa.z, bd = pa.depth, bp2 = pa.p;
      project(g1 + STRAND_OFFSET, y1, pb);
      prims.push({
        kind: "strand", z: (bz + pb.z) / 2,
        x1: bx, y1: by, x2: pb.x, y2: pb.y,
        d: (bd + pb.depth) / 2, p: (bp2 + pb.p) / 2
      });
    }

    /* Base pairs: one rung per pair, at the integer positions along the helix. */
    for (var i = 0; i < bpCount; i++) {
      var y = (i - half) * RISE - shift;
      var angle = i * TWIST + rotation;

      project(angle, y, pa);
      project(angle + STRAND_OFFSET, y, pb);

      var base = sequence[i];
      var pair = COMPLEMENT[base];

      /* the rung, split at the midpoint so each half carries its own base colour */
      prims.push({
        kind: "rung",
        z: (pa.z + pb.z) / 2,
        x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y,
        d1: pa.depth, d2: pb.depth,
        p: (pa.p + pb.p) / 2,
        c1: BASES[base], c2: BASES[pair]
      });

      /* a node where each base meets its backbone */
      prims.push({ kind: "node", z: pa.z, x: pa.x, y: pa.y, d: pa.depth, p: pa.p, c: BASES[base] });
      prims.push({ kind: "node", z: pb.z, x: pb.x, y: pb.y, d: pb.depth, p: pb.p, c: BASES[pair] });
    }

    /* painter's algorithm: far things first */
    prims.sort(function (a, b) { return a.z - b.z; });

    ctx.lineCap = "round";

    for (var k = 0; k < prims.length; k++) {
      var o = prims[k];

      if (o.kind === "strand") {
        ctx.strokeStyle = fog(BACKBONE, o.d);
        ctx.lineWidth = (1.8 + o.d * 3.6) * o.p;
        ctx.beginPath();
        ctx.moveTo(o.x1, o.y1);
        ctx.lineTo(o.x2, o.y2);
        ctx.stroke();

      } else if (o.kind === "rung") {
        var mx = (o.x1 + o.x2) / 2, my = (o.y1 + o.y2) / 2;
        ctx.lineWidth = (1.5 + ((o.d1 + o.d2) / 2) * 2.3) * o.p;

        ctx.strokeStyle = fog(o.c1, o.d1, 0.9);
        ctx.beginPath();
        ctx.moveTo(o.x1, o.y1);
        ctx.lineTo(mx, my);
        ctx.stroke();

        ctx.strokeStyle = fog(o.c2, o.d2, 0.9);
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(o.x2, o.y2);
        ctx.stroke();

      } else {
        ctx.fillStyle = fog(o.c, o.d);
        ctx.beginPath();
        ctx.arc(o.x, o.y, (1.9 + o.d * 2.8) * o.p, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* fade the helix out at the top and bottom edges so it runs off the panel */
    var fade = ctx.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, "rgba(247,245,240,1)");
    fade.addColorStop(0.13, "rgba(247,245,240,0)");
    fade.addColorStop(0.87, "rgba(247,245,240,0)");
    fade.addColorStop(1, "rgba(247,245,240,1)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);

    if (running) requestAnimationFrame(render);
  }

  function start() {
    if (running || reduceMotion.matches) return;
    running = true;
    lastTime = 0;
    requestAnimationFrame(render);
  }

  function stop() {
    running = false;
  }

  resize();

  if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(canvas.parentElement);
  } else {
    window.addEventListener("resize", resize);
  }

  /* only animate while the hero is actually on screen and the tab is visible */
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) start(); else stop();
    }, { threshold: 0 }).observe(canvas);
  } else {
    start();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  reduceMotion.addEventListener("change", function () {
    if (reduceMotion.matches) { stop(); render(0); } else start();
  });
})();
