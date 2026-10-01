/* Site-wide motion, layered on top of the existing pages: content eases up into
   place as it scrolls into view. With prefers-reduced-motion nothing animates in. */
(function () {
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
