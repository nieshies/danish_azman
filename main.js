/* ============================================================
   main.js — nav state, mobile menu, scroll reveals.
   ============================================================ */

(function () {
  "use strict";

  /* ---- mobile menu ---- */
  const burger = document.querySelector(".nav-burger");
  const links = document.querySelector(".nav-links");

  if (burger && links) {
    burger.addEventListener("click", function () {
      links.classList.toggle("open");
      burger.classList.toggle("x");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        burger.classList.remove("x");
      });
    });
  }

  /* ---- reveal on scroll ---- */
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 60 + "ms";
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- nav active section ---- */
  const navLinks = Array.prototype.slice.call(
    document.querySelectorAll(".nav-links ul a")
  );
  const sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);

  function setActive() {
    const line = window.scrollY + window.innerHeight * 0.35;
    let current = 0;
    sections.forEach(function (sec, i) {
      if (sec.offsetTop <= line) current = i;
    });
    navLinks.forEach(function (a, i) {
      a.classList.toggle("active", i === current);
    });
  }

  let ticking = false;
  window.addEventListener(
    "scroll",
    function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        setActive();
        setInvert();
        ticking = false;
      });
    },
    { passive: true }
  );
  setActive();

  /* ---- projects carousel ---- */
  (function () {
    const root = document.querySelector("[data-carousel]");
    if (!root) return;
    const stage = root.querySelector("[data-stage]");
    const dotsEl = root.querySelector("[data-dots]");
    const detail = root.querySelector("[data-detail]");
    const slides = Array.prototype.slice.call(root.querySelectorAll("[data-slide]"));
    if (!slides.length) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let active = 0;
    let suppressClickUntil = 0;

    // dots
    const dots = slides.map(function (_, i) {
      const b = document.createElement("button");
      b.className = "pc-dot";
      b.type = "button";
      b.setAttribute("aria-label", "Show project " + (i + 1));
      b.addEventListener("click", function () { select(i); });
      dotsEl.appendChild(b);
      return b;
    });

    function esc(str) {
      const d = document.createElement("div");
      d.textContent = str;
      return d.innerHTML;
    }

    // only same-origin or absolute http(s) links get rendered
    function safe(href) {
      return /^(https?:\/\/|\/|\.\.?\/|#)/i.test(href) && !/^javascript:/i.test(href);
    }

    function renderDetail(slide) {
      const d = slide.dataset;
      const tags = (d.tags || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean);
      const links = [];
      if (d.live && safe(d.live)) links.push(['Live site', d.live]);
      if (d.repo && safe(d.repo)) links.push(['Source code', d.repo]);

      detail.innerHTML =
        '<span class="pc-cat">' + d.category + '</span>' +
        '<h3 class="pc-title">' + esc(d.title) + '</h3>' +
        (d.status ? '<span class="pc-status">' + esc(d.status) + '</span>' : '') +
        '<p class="pc-desc">' + d.desc + '</p>' +
        (tags.length ? '<div class="pc-tags">' + tags.map(function (t) {
          return '<span>' + esc(t) + '</span>';
        }).join('') + '</div>' : '') +
        '<div class="pc-links">' + links.map(function (l) {
          return '<a href="' + l[1] + '" target="_blank" rel="noopener">' + l[0] + ' &#8599;</a>';
        }).join('') + '</div>';
    }

    function select(i) {
      active = (i + slides.length) % slides.length;
      slides.forEach(function (slide, index) {
        const distance = (index - active + slides.length) % slides.length;
        let state = "hidden";
        if (distance === 0) state = "active";
        else if (distance === 1) state = "next";
        else if (distance === slides.length - 1) state = "previous";
        if (reduced && state !== "active") state = "hidden";
        slide.dataset.state = state;
        slide.tabIndex = state === "hidden" ? -1 : 0;
      });
      dots.forEach(function (dot, index) {
        dot.classList.toggle("is-active", index === active);
        dot.tabIndex = index === active ? 0 : -1;
        dot.setAttribute("aria-pressed", index === active ? "true" : "false");
      });
      renderDetail(slides[active]);
    }

    slides.forEach(function (slide, i) {
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "slide");
      slide.addEventListener("click", function () {
        if (Date.now() < suppressClickUntil) return;
        select(i);
      });
      slide.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(i); }
      });

      // hover parallax, fine pointers only — composes with the state transform
      if (fine && !reduced) {
        slide.addEventListener("pointermove", function (e) {
          const b = slide.getBoundingClientRect();
          const x = (e.clientX - b.left) / b.width - 0.5;
          const y = (e.clientY - b.top) / b.height - 0.5;
          slide.style.setProperty("--tilt-x", (-y * 7).toFixed(2) + "deg");
          slide.style.setProperty("--tilt-y", (x * 9).toFixed(2) + "deg");
        });
        slide.addEventListener("pointerleave", function () {
          slide.style.setProperty("--tilt-x", "0deg");
          slide.style.setProperty("--tilt-y", "0deg");
        });
      }
    });

    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); select(active + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); select(active - 1); }
    });

    // swipe — touch and pen only, so a mouse drag never hijacks a click
    let sx = 0, sy = 0, tracking = false;
    stage.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      tracking = true; sx = e.clientX; sy = e.clientY;
    });
    stage.addEventListener("pointerup", function (e) {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) >= 28 && Math.abs(dx) >= Math.abs(dy) * 1.1) {
        select(active + (dx < 0 ? 1 : -1));
        suppressClickUntil = Date.now() + 650;
      }
    });

    select(0);
  })();

  /* ---- nav inverts over the dark contact section ---- */
  const nav = document.querySelector(".nav");
  const contact = document.getElementById("contact");

  function setInvert() {
    if (!nav || !contact) return;
    const navH = nav.offsetHeight;
    const top = contact.getBoundingClientRect().top;
    nav.classList.toggle("invert", top <= navH * 0.6);
  }

  setInvert();

  /* ---- footer year ---- */
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
