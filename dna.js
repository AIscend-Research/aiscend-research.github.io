/* Animated DNA double helix for the home hero.
   Draws on a white panel using the site palette (forest strands, amber nodes). */
(function () {
  var canvas = document.getElementById("dna-canvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var FOREST = [18, 59, 51];   /* --forest */
  var AMBER = [240, 178, 92];  /* --amber */

  /* opaque tint toward the white panel; overlapping segment caps stay invisible */
  function tint(rgb, strength) {
    var r = Math.round(255 + (rgb[0] - 255) * strength);
    var g = Math.round(255 + (rgb[1] - 255) * strength);
    var b = Math.round(255 + (rgb[2] - 255) * strength);
    return "rgb(" + r + "," + g + "," + b + ")";
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

      segments.push({ x1: x1, z1: z1, x2: x2, z2: z2, y: y, i: i });
    }

    /* base-pair rungs first, so strands render over them */
    for (var r = 0; r < segments.length; r++) {
      if (segments[r].i % rungEvery !== 0) continue;
      var s = segments[r];
      var depth = (s.z1 + 1) / 2; /* 0 = back, 1 = front (per near end) */
      ctx.strokeStyle = tint(FOREST, 0.14 + depth * 0.18);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y);
      ctx.lineTo(s.x2, s.y);
      ctx.stroke();

      /* amber nodes at each rung end, scaled by depth */
      drawNode(s.x1, s.y, s.z1);
      drawNode(s.x2, s.y, s.z2);
    }

    /* the two strands, drawn as depth-shaded polylines */
    drawStrand(segments, "x1", "z1");
    drawStrand(segments, "x2", "z2");

    if (!reduceMotion) requestAnimationFrame(draw);
  }

  function drawStrand(segments, xKey, zKey) {
    for (var i = 1; i < segments.length; i++) {
      var a = segments[i - 1], b = segments[i];
      var depth = ((a[zKey] + b[zKey]) / 2 + 1) / 2;
      ctx.strokeStyle = tint(FOREST, 0.25 + depth * 0.65);
      ctx.lineWidth = 3.2 + depth * 3.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a[xKey], a.y);
      ctx.lineTo(b[xKey], b.y);
      ctx.stroke();
    }
  }

  function drawNode(x, y, z) {
    var depth = (z + 1) / 2;
    ctx.fillStyle = tint(AMBER, 0.45 + depth * 0.55);
    ctx.beginPath();
    ctx.arc(x, y, 3 + depth * 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(draw);
})();
