/* Animated DNA double helix for the home hero.
   Draws on a white panel using the site palette. The strands carry a colour ramp
   that travels down the helix; each rung is a base pair (A·T / G·C) with its own hue. */
(function () {
  var canvas = document.getElementById("dna-canvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var FOREST = [18, 59, 51];      /* --forest */
  var FOREST_LIFT = [26, 77, 67]; /* --forest-lift */
  var GREEN_LINK = [31, 92, 80];  /* --green-link */
  var TEAL = [23, 130, 112];      /* forest hue, opened up */
  var AMBER = [240, 178, 92];     /* --amber */
  var BLUSH = [240, 160, 168];    /* --blush */
  var CLARET = [143, 45, 60];     /* --claret, lifted off black */

  /* the ramp the strands travel through — forest out to amber and back via claret */
  var RAMP = [FOREST, GREEN_LINK, TEAL, AMBER, BLUSH, CLARET, FOREST_LIFT];

  /* base pairs: A pairs with T, G pairs with C — each pair gets two related hues */
  var PAIRS = [
    [AMBER, CLARET],   /* A · T */
    [TEAL, BLUSH],     /* G · C */
    [CLARET, AMBER],   /* T · A */
    [BLUSH, TEAL]      /* C · G */
  ];

  function mix(a, b, k) {
    return [
      a[0] + (b[0] - a[0]) * k,
      a[1] + (b[1] - a[1]) * k,
      a[2] + (b[2] - a[2]) * k
    ];
  }

  /* sample the ramp at a looping position 0..1 */
  function ramp(p) {
    var f = ((p % 1) + 1) % 1 * RAMP.length;
    var i = Math.floor(f);
    return mix(RAMP[i % RAMP.length], RAMP[(i + 1) % RAMP.length], f - i);
  }

  /* opaque tint toward the white panel; overlapping segment caps stay invisible */
  function tint(rgb, strength) {
    var r = Math.round(255 + (rgb[0] - 255) * strength);
    var g = Math.round(255 + (rgb[1] - 255) * strength);
    var b = Math.round(255 + (rgb[2] - 255) * strength);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function rgba(rgb, alpha) {
    return "rgba(" + Math.round(rgb[0]) + "," + Math.round(rgb[1]) + "," +
      Math.round(rgb[2]) + "," + alpha + ")";
  }

  var w = 0, h = 0, dpr = 1;

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(time) {
    ctx.clearRect(0, 0, w, h);

    var cx = w / 2;
    var amplitude = Math.min(w * 0.22, 150);
    var margin = h * 0.06;
    var turns = 2.4;                 /* full twists visible in the panel */
    var steps = 90;                  /* samples along each strand */
    var rungEvery = 6;
    var t = reduceMotion ? 0 : time * 0.0006;
    var flow = reduceMotion ? 0 : time * 0.00008;  /* colour drifting down the helix */

    /* collect points so rungs and strands can be depth-sorted */
    var segments = [];

    for (var i = 0; i < steps; i++) {
      var p = i / (steps - 1);
      var y = margin + p * (h - margin * 2);
      var angle = p * turns * Math.PI * 2 + t;

      var x1 = cx + Math.sin(angle) * amplitude;
      var z1 = Math.cos(angle);
      var x2 = cx + Math.sin(angle + Math.PI) * amplitude;
      var z2 = Math.cos(angle + Math.PI);

      segments.push({ x1: x1, z1: z1, x2: x2, z2: z2, y: y, p: p, i: i });
    }

    /* base-pair rungs first, so strands render over them */
    for (var r = 0; r < segments.length; r++) {
      if (segments[r].i % rungEvery !== 0) continue;
      var s = segments[r];
      var pair = PAIRS[(r / rungEvery) % PAIRS.length];
      var depth = (s.z1 + 1) / 2; /* 0 = back, 1 = front (per near end) */

      /* the rung fades from one base's colour to its partner's */
      var grad = ctx.createLinearGradient(s.x1, s.y, s.x2, s.y);
      grad.addColorStop(0, tint(pair[0], 0.28 + depth * 0.42));
      grad.addColorStop(1, tint(pair[1], 0.70 - depth * 0.42));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y);
      ctx.lineTo(s.x2, s.y);
      ctx.stroke();

      /* a node at each rung end, in that base's colour, scaled by depth */
      drawNode(s.x1, s.y, s.z1, pair[0]);
      drawNode(s.x2, s.y, s.z2, pair[1]);
    }

    /* the two strands, drawn as depth-shaded polylines */
    drawStrand(segments, "x1", "z1", flow);
    drawStrand(segments, "x2", "z2", flow + 0.5);

    if (!reduceMotion) requestAnimationFrame(draw);
  }

  function drawStrand(segments, xKey, zKey, flow) {
    for (var i = 1; i < segments.length; i++) {
      var a = segments[i - 1], b = segments[i];
      var depth = ((a[zKey] + b[zKey]) / 2 + 1) / 2;
      var hue = ramp((a.p + b.p) * 0.35 + flow);
      ctx.strokeStyle = tint(hue, 0.30 + depth * 0.60);
      ctx.lineWidth = 3.2 + depth * 3.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a[xKey], a.y);
      ctx.lineTo(b[xKey], b.y);
      ctx.stroke();
    }
  }

  function drawNode(x, y, z, color) {
    var depth = (z + 1) / 2;
    var radius = 3 + depth * 3.4;

    /* a soft glow behind the front-facing nodes so the colour reads */
    if (depth > 0.5) {
      var glow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 2.4);
      glow.addColorStop(0, rgba(color, (depth - 0.5) * 0.36));
      glow.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = tint(color, 0.45 + depth * 0.55);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(draw);
})();
