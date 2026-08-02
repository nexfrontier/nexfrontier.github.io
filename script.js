(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isFinePointer = window.matchMedia("(pointer: fine)").matches;
  if (isFinePointer && !reduceMotion) document.body.classList.add("has-fine-pointer");

  /* ---------------------------------------------------------
     Nav: solid background after scroll, mobile menu toggle
  --------------------------------------------------------- */
  var nav = document.getElementById("nav");
  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");

  function onScrollNav() {
    if (window.scrollY > 12) nav.classList.add("is-scrolled");
    else nav.classList.remove("is-scrolled");
  }
  onScrollNav();
  window.addEventListener("scroll", onScrollNav, { passive: true });

  if (navToggle) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navLinks.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------------------------------------------------------
     Live local-time readout in the status bar
  --------------------------------------------------------- */
  var timeEl = document.getElementById("localTime");
  function tickClock() {
    if (!timeEl) return;
    var now = new Date();
    var h = String(now.getHours()).padStart(2, "0");
    var m = String(now.getMinutes()).padStart(2, "0");
    var s = String(now.getSeconds()).padStart(2, "0");
    timeEl.textContent = h + ":" + m + ":" + s;
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ---------------------------------------------------------
     Scroll reveal for elements with .reveal
  --------------------------------------------------------- */
  var revealEls = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------
     Stat count-up (triggered once, when in view)
  --------------------------------------------------------- */
  var statEls = document.querySelectorAll(".stat-num");
  function animateCount(el) {
    var target = parseInt(el.getAttribute("data-count"), 10) || 0;
    if (reduceMotion) { el.textContent = target; return; }
    var start = null;
    var duration = 1100;
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if (statEls.length && "IntersectionObserver" in window) {
    var statIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            statIo.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    statEls.forEach(function (el) { statIo.observe(el); });
  }

  /* ---------------------------------------------------------
     Route line + signal dot: tracks reading progress through
     the waypoint sections (about -> ... -> contact)
  --------------------------------------------------------- */
  var routeLine = document.getElementById("routeLine");
  var routeProgress = document.getElementById("routeProgress");
  var signalDot = document.getElementById("signalDot");
  var waypoints = document.querySelectorAll(".waypoint");

  var routeStart = 0, routeEnd = 0, routeHeight = 0;

  function measureRoute() {
    if (!waypoints.length || !routeLine) return;
    var first = waypoints[0];
    var last = waypoints[waypoints.length - 1];
    var firstRect = first.getBoundingClientRect();
    var lastRect = last.getBoundingClientRect();
    var scrollY = window.scrollY || window.pageYOffset;

    routeStart = firstRect.top + scrollY;
    routeEnd = lastRect.bottom + scrollY;
    routeHeight = Math.max(routeEnd - routeStart, 1);

    routeLine.style.top = routeStart + "px";
    routeLine.style.height = routeHeight + "px";
  }

  function updateRoute() {
    if (!routeLine || routeHeight <= 1) return;
    var scrollY = window.scrollY || window.pageYOffset;
    var viewportAnchor = scrollY + window.innerHeight * 0.4;
    var progress = (viewportAnchor - routeStart) / routeHeight;
    progress = Math.max(0, Math.min(1, progress));

    routeProgress.style.height = (progress * 100) + "%";
    signalDot.style.top = (routeStart + progress * routeHeight) + "px";

    if (viewportAnchor >= routeStart && viewportAnchor <= routeEnd) {
      signalDot.classList.add("is-active");
    } else {
      signalDot.classList.remove("is-active");
    }
  }

  var rafPending = false;
  function onScrollRoute() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      updateRoute();
      rafPending = false;
    });
  }

  if (routeLine && waypoints.length) {
    measureRoute();
    updateRoute();
    window.addEventListener("scroll", onScrollRoute, { passive: true });
    window.addEventListener("resize", function () {
      measureRoute();
      updateRoute();
    });
    // fonts loading can shift layout; re-measure after a beat
    window.addEventListener("load", function () {
      measureRoute();
      updateRoute();
    });
  }
  /* ---------------------------------------------------------
     Hero particle network — nodes drift and link when close,
     gently pulled toward the cursor
  --------------------------------------------------------- */
  var canvas = document.getElementById("particleCanvas");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var hero = document.getElementById("hero");
    var particles = [];
    var mouse = { x: null, y: null, active: false };
    var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);

    function sizeCanvas() {
      var rect = hero.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function makeParticles() {
      var count = reduceMotion ? 0 : Math.min(70, Math.round((W * H) / 15000));
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: Math.random() * 1.4 + 0.8
        });
      }
    }

    sizeCanvas();
    makeParticles();

    var linkDist = 130;

    function drawFrame() {
      ctx.clearRect(0, 0, W, H);

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];

        if (mouse.active) {
          var dx = p.x - mouse.x, dy = p.y - mouse.y;
          var d2 = dx * dx + dy * dy;
          var influence = 140 * 140;
          if (d2 < influence) {
            var dist = Math.sqrt(d2) || 1;
            var force = (1 - dist / 140) * 0.045;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx; p.y += p.vy;

        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(226, 229, 245, 0.55)";
        ctx.fill();
      }

      for (var a = 0; a < particles.length; a++) {
        for (var b = a + 1; b < particles.length; b++) {
          var pa = particles[a], pb = particles[b];
          var ddx = pa.x - pb.x, ddy = pa.y - pb.y;
          var dist2 = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dist2 < linkDist) {
            var alpha = (1 - dist2 / linkDist) * 0.5;
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            var grad = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
            grad.addColorStop(0, "rgba(108,92,233," + alpha + ")");
            grad.addColorStop(1, "rgba(47,230,196," + alpha + ")");
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(drawFrame);
    }

    if (!reduceMotion) {
      requestAnimationFrame(drawFrame);
    } else {
      drawFrame = function () {}; // static canvas for reduced-motion users
    }

    hero.addEventListener("mousemove", function (e) {
      var rect = hero.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    });
    hero.addEventListener("mouseleave", function () { mouse.active = false; });

    window.addEventListener("resize", function () {
      sizeCanvas();
      makeParticles();
    });
  }

  /* ---------------------------------------------------------
     Custom cursor glow — follows the pointer with soft easing
  --------------------------------------------------------- */
  var glow = document.getElementById("cursorGlow");
  if (glow && isFinePointer && !reduceMotion) {
    var gx = window.innerWidth / 2, gy = window.innerHeight / 2;
    var tx = gx, ty = gy;
    window.addEventListener("mousemove", function (e) {
      tx = e.clientX; ty = e.clientY;
    });
    function glowLoop() {
      gx += (tx - gx) * 0.14;
      gy += (ty - gy) * 0.14;
      glow.style.transform = "translate3d(" + gx + "px," + gy + "px,0)";
      requestAnimationFrame(glowLoop);
    }
    requestAnimationFrame(glowLoop);
  }

  /* ---------------------------------------------------------
     Magnetic buttons — pull gently toward the cursor
  --------------------------------------------------------- */
  if (isFinePointer && !reduceMotion) {
    document.querySelectorAll(".magnetic").forEach(function (el) {
      var strength = 0.35;
      el.addEventListener("mousemove", function (e) {
        var rect = el.getBoundingClientRect();
        var mx = e.clientX - (rect.left + rect.width / 2);
        var my = e.clientY - (rect.top + rect.height / 2);
        el.style.transform = "translate(" + (mx * strength) + "px," + (my * strength) + "px)";
      });
      el.addEventListener("mouseleave", function () {
        el.style.transform = "";
      });
    });
  }

  /* ---------------------------------------------------------
     3D tilt — service cards, work mockups, team + CEO avatars
  --------------------------------------------------------- */
  if (isFinePointer && !reduceMotion) {
    document.querySelectorAll(".tilt").forEach(function (el) {
      var maxTilt = 9;
      el.addEventListener("mousemove", function (e) {
        var rect = el.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width;
        var py = (e.clientY - rect.top) / rect.height;
        var rx = (0.5 - py) * maxTilt * 2;
        var ry = (px - 0.5) * maxTilt * 2;
        el.style.transform =
          "perspective(700px) rotateX(" + rx + "deg) rotateY(" + ry + "deg) translateY(-3px)";
      });
      el.addEventListener("mouseleave", function () {
        el.style.transform = "";
      });
    });
  }

})();
