/* =========================================================
   MarkGate — interactions
   ========================================================= */
(function () {
  "use strict";

  const header = document.getElementById("siteHeader");
  const nav = document.getElementById("siteNav");
  const toggle = document.getElementById("navToggle");
  const toTop = document.getElementById("toTop");

  /* ----- Header state on scroll ----- */
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle("scrolled", y > 40);
    if (toTop) toTop.classList.toggle("show", y > 600);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

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

  /* ----- Reveal on scroll ----- */
  const revealTargets = [
    ".section-head", ".h2", ".section-intro",
    ".concept-body", ".concept-lead",
    ".problem-col", ".problem-arrow",
    ".card", ".feature-item", ".step",
    ".stat", ".company-table", ".company-note",
    ".contact-lead", ".contact-form", ".audience-cta"
  ];
  const els = document.querySelectorAll(revealTargets.join(","));
  els.forEach((el, i) => {
    el.classList.add("reveal");
    el.style.transitionDelay = (i % 4) * 90 + "ms";
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
