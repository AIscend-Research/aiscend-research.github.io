/* Real DNA in the home hero.

   The structure is PDB entry 1BNA, the Drew-Dickerson dodecamer (Drew et al., 1981), the
   first full turn of B-DNA solved by X-ray crystallography. Sequence CGCGAATTCGCG, held
   locally in assets/1bna.pdb exactly as distributed by the RCSB Protein Data Bank.

   The only thing done to the coordinates is a rigid rotation: the helical axis is found by
   principal component analysis of the atom positions and stood upright, so the duplex runs
   up the panel instead of lying at the angle it was deposited in. Nothing is added, moved
   or invented, so the backbone has no seams in it.

   Rendering is 3Dmol.js, a WebGL molecular graphics library used in structural biology. */
(function () {
  var mount = document.getElementById("dna-viewer");
  if (!mount || typeof $3Dmol === "undefined") return;

  var BONE = "#f7f5f0";     /* panel background */

  /* The standard textbook key: a tan sugar-phosphate backbone with each base
     given its own colour. */
  var TAN = "#edc87f";      /* phosphate backbone */
  var ADENINE = "#7fdd85";  /* green */
  var THYMINE = "#c48ce6";  /* purple */
  var CYTOSINE = "#f4808a"; /* red */
  var GUANINE = "#7f8fe8";  /* blue */

  /* sugar and phosphate atoms, so only the bases themselves get base colours */
  var BACKBONE_ATOMS = ["P", "OP1", "OP2", "O1P", "O2P", "O5'", "C5'",
                        "C4'", "O4'", "C3'", "O3'", "C2'", "C1'"];

  /* ---------- geometry helpers ---------- */

  /* largest eigenvector of the coordinate covariance: the long axis of the duplex */
  function dominantAxis(points) {
    var c = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      for (var a = 0; a < 3; a++) {
        for (var b = 0; b < 3; b++) c[a][b] += p[a] * p[b];
      }
    }

    var v = [1, 1, 1];
    for (var it = 0; it < 64; it++) {
      var n = [
        c[0][0] * v[0] + c[0][1] * v[1] + c[0][2] * v[2],
        c[1][0] * v[0] + c[1][1] * v[1] + c[1][2] * v[2],
        c[2][0] * v[0] + c[2][1] * v[1] + c[2][2] * v[2]
      ];
      var len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1;
      v = [n[0] / len, n[1] / len, n[2] / len];
    }
    return v;
  }

  /* rotation matrix taking unit vector u onto unit vector w (Rodrigues) */
  function alignMatrix(u, w) {
    var d = u[0] * w[0] + u[1] * w[1] + u[2] * w[2];
    if (d > 0.999999) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    if (d < -0.999999) return [[-1, 0, 0], [0, -1, 0], [0, 0, 1]];

    var ax = [
      u[1] * w[2] - u[2] * w[1],
      u[2] * w[0] - u[0] * w[2],
      u[0] * w[1] - u[1] * w[0]
    ];
    var s = Math.sqrt(ax[0] * ax[0] + ax[1] * ax[1] + ax[2] * ax[2]);
    var k = [ax[0] / s, ax[1] / s, ax[2] / s];
    var ct = d, st = s, vt = 1 - ct;

    return [
      [ct + k[0] * k[0] * vt,        k[0] * k[1] * vt - k[2] * st, k[0] * k[2] * vt + k[1] * st],
      [k[1] * k[0] * vt + k[2] * st, ct + k[1] * k[1] * vt,        k[1] * k[2] * vt - k[0] * st],
      [k[2] * k[0] * vt - k[1] * st, k[2] * k[1] * vt + k[0] * st, ct + k[2] * k[2] * vt]
    ];
  }

  function col(v) {
    var s = v.toFixed(3);
    while (s.length < 8) s = " " + s;
    return s;
  }

  /* Stand the deposited structure upright, leaving everything else untouched. */
  function upright(pdb) {
    var lines = pdb.split("\n");
    var kept = [], coords = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf("ATOM") !== 0 && line.indexOf("HETATM") !== 0) continue;
      if (line.substr(17, 3).trim() === "HOH") continue;   /* drop crystal waters */

      kept.push(line);
      coords.push([
        parseFloat(line.substr(30, 8)),
        parseFloat(line.substr(38, 8)),
        parseFloat(line.substr(46, 8))
      ]);
    }
    if (!kept.length) return null;

    var mean = [0, 0, 0];
    coords.forEach(function (p) { mean[0] += p[0]; mean[1] += p[1]; mean[2] += p[2]; });
    mean = [mean[0] / coords.length, mean[1] / coords.length, mean[2] / coords.length];

    var centred = coords.map(function (p) {
      return [p[0] - mean[0], p[1] - mean[1], p[2] - mean[2]];
    });

    var m = alignMatrix(dominantAxis(centred), [0, 1, 0]);
    var out = [];

    for (var j = 0; j < kept.length; j++) {
      var p = centred[j];
      var x = m[0][0] * p[0] + m[0][1] * p[1] + m[0][2] * p[2];
      var y = m[1][0] * p[0] + m[1][1] * p[1] + m[1][2] * p[2];
      var z = m[2][0] * p[0] + m[2][1] * p[1] + m[2][2] * p[2];
      out.push(kept[j].substr(0, 30) + col(x) + col(y) + col(z) + kept[j].substr(54));
    }

    return out.join("\n") + "\nEND\n";
  }

  var viewer;
  try {
    viewer = $3Dmol.createViewer(mount, {
      backgroundColor: BONE,
      antialias: true,
      disableFog: true
    });
  } catch (e) {
    return; /* no WebGL: the panel just stays empty rather than breaking the page */
  }
  if (!viewer) return;

  fetch("assets/1bna.pdb")
    .then(function (r) { return r.text(); })
    .then(function (pdb) {
      var model = upright(pdb);
      if (!model) return;

      viewer.addModel(model, "pdb");

      /* the sugar-phosphate backbone: a tan ribbon down each strand */
      viewer.setStyle({}, {
        cartoon: { color: TAN, style: "oval", thickness: 0.9 }
      });

      /* each base in its own colour */
      viewer.addStyle({ resn: ["DA", "A", "ADE"] }, { stick: { color: ADENINE, radius: 0.17 } });
      viewer.addStyle({ resn: ["DT", "T", "THY"] }, { stick: { color: THYMINE, radius: 0.17 } });
      viewer.addStyle({ resn: ["DC", "C", "CYT"] }, { stick: { color: CYTOSINE, radius: 0.17 } });
      viewer.addStyle({ resn: ["DG", "G", "GUA"] }, { stick: { color: GUANINE, radius: 0.17 } });

      /* the sugars and phosphates stay backbone-coloured, so only the rungs are keyed */
      viewer.addStyle({ atom: BACKBONE_ATOMS }, { stick: { color: TAN, radius: 0.17 } });

      viewer.zoomTo();
      viewer.zoom(0.70);
      viewer.rotate(20, "z");   /* lean the helix off vertical */
      viewer.render();

      /* turn left to right, about the vertical axis, so it stays standing */
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        viewer.spin("y", 0.4);
      }

      /* pause while the hero is off screen or the tab is hidden */
      var spinning = true;
      function setSpin(on) {
        if (on === spinning) return;
        spinning = on;
        viewer.spin(on ? "y" : false, 0.4);
      }

      if (window.IntersectionObserver) {
        new IntersectionObserver(function (entries) {
          setSpin(entries[0].isIntersecting && !document.hidden);
        }, { threshold: 0 }).observe(mount);
      }

      document.addEventListener("visibilitychange", function () {
        setSpin(!document.hidden);
      });
    })
    .catch(function () { /* structure unavailable: leave the panel plain */ });

  window.addEventListener("resize", function () {
    if (viewer) viewer.resize();
  });
})();
