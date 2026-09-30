/* Site-wide motion, layered on top of the existing pages.

   1. A drifting neural network behind every forest-green hero: nodes joined by faint
      edges, with amber signals firing along them. It reaches toward the cursor.
   2. Content eases up into place as it scrolls into view.

   Everything is decorative. With prefers-reduced-motion the network is drawn once and
   held still, and nothing animates in. */
(function () {
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- neural network canvas ---------- */

  var SAGE = "127, 168, 156";   /* #7fa89c, the ghost-button outline */
  var AMBER = "240, 178, 92";   /* --amber */
  var REACH = 140;              /* px: how close two nodes must be to connect */

  function network(host) {
    var canvas = document.createElement("canvas");
    canvas.className = "fx-net";
    canvas.setAttribute("aria-hidden", "true");

    /* sit above the soft blobs but below the text, which is already position: relative */
    var blobs = host.querySelector(".blobs");
    host.insertBefore(canvas, blobs ? blobs.nextSibling : host.firstChild);

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var w = 0, h = 0, nodes = [], pulses = [], mouse = null;
    var running = false, raf = 0, lastSpawn = 0, last = 0;

    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = host.clientWidth;
      h = host.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var count = Math.max(18, Math.min(70, Math.round((w * h) / 11000)));
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          r: 1.3 + Math.random() * 1.5,
          hot: Math.random() < 0.12      /* a few nodes glow amber */
        });
      }
      pulses = [];
      if (!running) draw(0);
    }

    function neighbours(a) {
      var out = [];
      for (var i = 0; i < nodes.length; i++) {
        var b = nodes[i];
        if (b === a) continue;
        var dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy < REACH * REACH) out.push(b);
      }
      return out;
    }

    function spawn() {
      var a = nodes[(Math.random() * nodes.length) | 0];
      var near = neighbours(a);
      if (!near.length) return;
      pulses.push({ a: a, b: near[(Math.random() * near.length) | 0], t: 0, hops: 2 });
    }

    function step(dt) {
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;
      }

      for (var j = pulses.length - 1; j >= 0; j--) {
        var p = pulses[j];
        p.t += dt / 70;
        if (p.t < 1) continue;
        /* a signal that arrives sometimes fires onward, like a forward pass */
        var next = p.hops > 0 ? neighbours(p.b) : [];
        if (next.length) {
          pulses[j] = { a: p.b, b: next[(Math.random() * next.length) | 0], t: 0, hops: p.hops - 1 };
        } else {
          pulses.splice(j, 1);
        }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      /* edges */
      ctx.lineWidth = 1;
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        for (var k = i + 1; k < nodes.length; k++) {
          var b = nodes[k];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d2 = dx * dx + dy * dy;
          if (d2 > REACH * REACH) continue;
          var alpha = (1 - Math.sqrt(d2) / REACH) * 0.28;
          ctx.strokeStyle = "rgba(" + SAGE + "," + alpha + ")";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }

        /* the cursor acts as one more node */
        if (mouse) {
          var mx = a.x - mouse.x, my = a.y - mouse.y;
          var md = Math.sqrt(mx * mx + my * my);
          if (md < REACH * 1.3) {
            ctx.strokeStyle = "rgba(" + AMBER + "," + (1 - md / (REACH * 1.3)) * 0.35 + ")";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      /* nodes */
      for (var n = 0; n < nodes.length; n++) {
        var o = nodes[n];
        ctx.fillStyle = o.hot ? "rgba(" + AMBER + ",0.7)" : "rgba(" + SAGE + ",0.55)";
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
      }

      /* signals in flight */
      for (var s = 0; s < pulses.length; s++) {
        var p = pulses[s];
        var x = p.a.x + (p.b.x - p.a.x) * p.t;
        var y = p.a.y + (p.b.y - p.a.y) * p.t;
        var g = ctx.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, "rgba(" + AMBER + ",0.95)");
        g.addColorStop(1, "rgba(" + AMBER + ",0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function frame(now) {
      var dt = last ? Math.min((now - last) / 16.67, 3) : 1;
      last = now;
      if (now - lastSpawn > 420 && pulses.length < 14) {
        spawn();
        lastSpawn = now;
      }
      step(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }

    function play(on) {
      if (still || on === running) return;
      running = on;
      if (on) {
        last = 0;
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
      }
    }

    size();

    if (window.ResizeObserver) new ResizeObserver(size).observe(host);
    else window.addEventListener("resize", size);

    if (!still) {
      host.addEventListener("pointermove", function (e) {
        var r = host.getBoundingClientRect();
        mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      });
      host.addEventListener("pointerleave", function () { mouse = null; });

      var visible = true;
      if (window.IntersectionObserver) {
        new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          play(visible && !document.hidden);
        }).observe(host);
      }
      document.addEventListener("visibilitychange", function () {
        play(visible && !document.hidden);
      });
      play(true);
    }
  }

  var hosts = document.querySelectorAll(".hero-panel, .page-hero");
  for (var i = 0; i < hosts.length; i++) network(hosts[i]);

  /* ---------- reveal on scroll ---------- */

  if (still || !window.IntersectionObserver) return;

  var targets = document.querySelectorAll(
    ".section .col-body, .section .eyebrow-light, .card, .paper, .person, " +
    ".venue-list li, .collab-logos img, .phase"
  );

  document.documentElement.classList.add("fx-ready");

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("fx-in");
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

  for (var t = 0; t < targets.length; t++) {
    var el = targets[t];
    /* siblings in a grid or row arrive one after another */
    var index = Array.prototype.indexOf.call(el.parentNode.children, el);
    el.style.transitionDelay = (index % 4) * 90 + "ms";
    el.classList.add("fx-reveal");
    io.observe(el);
  }
})();
