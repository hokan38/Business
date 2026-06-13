/* =========================================================
   MarkGate — interactions
   ========================================================= */
(function () {
  "use strict";

  const header = document.getElementById("siteHeader");
  const nav = document.getElementById("siteNav");
  const toggle = document.getElementById("navToggle");
  const toTop = document.getElementById("toTop");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----- Scroll progress bar ----- */
  let progress = null;
  if (!reduceMotion) {
    progress = document.createElement("div");
    progress.className = "scroll-progress";
    document.body.appendChild(progress);
  }

  /* ----- Mobile nav ----- */
  const closeNav = () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  };
  if (toggle) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("nav-open", open);
    });
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeNav));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeNav();
    });
  }

  /* ----- Parallax targets (hero) ----- */
  const heroGlow = document.querySelector(".hero-glow");
  const heroLines = document.querySelector(".hero-lines");
  const heroInner = document.querySelector(".hero-inner");
  [heroGlow, heroLines, heroInner].forEach((el) => el && el.setAttribute("data-parallax", ""));

  /* ----- Combined scroll handler (header / progress / parallax) ----- */
  let ticking = false;
  const render = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;

    header.classList.toggle("scrolled", y > 40);
    if (toTop) toTop.classList.toggle("show", y > 600);

    if (progress) {
      const max = document.documentElement.scrollHeight - vh;
      progress.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
    }

    if (!reduceMotion && y < vh * 1.5) {
      // hero elements lag behind the scroll for a sense of depth
      if (heroGlow) heroGlow.style.transform = "translate(-50%," + y * 0.4 + "px)";
      if (heroLines) heroLines.style.transform = "translateY(" + y * 0.2 + "px)";
      if (heroInner) {
        heroInner.style.transform = "translateY(" + y * 0.28 + "px)";
        heroInner.style.opacity = String(Math.max(0, 1 - y / (vh * 0.72)));
      }
    }
    ticking = false;
  };
  const onScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(render);
      ticking = true;
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  render();

  /* ----- Directional, staggered reveal on scroll ----- */
  const revealConfig = [
    [".section-head", "up"],
    [".concept-lead", "left"],
    [".concept-body", "right"],
    [".problem-col.problem-col-new", "right"],
    [".problem-col:not(.problem-col-new)", "left"],
    [".problem-arrow", "scale"],
    [".card", "scale"],
    [".feature-item", "up"],
    [".step", "scale"],
    [".stat", "up"],
    [".company-table", "up"],
    [".company-note", "up"],
    [".contact-lead", "left"],
    [".contact-form", "right"],
    [".audience-cta", "up"],
    [".audience-head .h2", "up"],
    [".audience-head .section-intro", "up"],
    [".strength > .container > .h2", "up"],
    [".flow > .container > .h2", "up"],
    [".company > .container > .h2", "up"],
    [".problem .h2", "up"],
    [".problem .section-intro", "up"],
  ];

  const els = [];
  revealConfig.forEach(([sel, dir]) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      if (el.classList.contains("reveal")) return; // avoid double-tagging
      el.classList.add("reveal", "reveal--" + dir);
      el.style.transitionDelay = (i % 4) * 90 + "ms";
      els.push(el);
    });
  });

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
  } else {
    els.forEach((el) => el.classList.add("in"));
  }

  /* ----- Animated counters ----- */
  const counters = document.querySelectorAll("[data-count]");
  const runCount = (el) => {
    const target = parseFloat(el.getAttribute("data-count"));
    const dur = 1400;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toString();
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target.toString();
    };
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    const co = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runCount(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((c) => co.observe(c));
  }

  /* ----- Year ----- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ----- Contact form (front-end demo handler) ----- */
  const form = document.getElementById("contactForm");
  const status = document.getElementById("formStatus");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      status.className = "form-status";
      const email = form.querySelector("#cf-email");
      const agree = form.querySelector("#cf-agree");
      if (!form.checkValidity()) {
        status.textContent = "未入力の必須項目があります。ご確認ください。";
        status.classList.add("err");
        form.reportValidity();
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        status.textContent = "メールアドレスの形式をご確認ください。";
        status.classList.add("err");
        return;
      }
      if (agree && !agree.checked) {
        status.textContent = "プライバシーポリシーへの同意が必要です。";
        status.classList.add("err");
        return;
      }
      // NOTE: 送信先APIは未接続のデモ実装です。実運用時はここでfetch等に置き換えてください。
      status.textContent = "お問い合わせありがとうございます。担当者より折り返しご連絡いたします。";
      status.classList.add("ok");
      form.reset();
    });
  }
})();
