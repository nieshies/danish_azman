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
