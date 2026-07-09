/* =========================================================
   MarkGate Platform — Common helpers & UI chrome
   すべてのプラットフォームページで共有するユーティリティ、
   ヘッダー/フッターの描画、指名（nomination）モーダルを提供します。
   ========================================================= */
(function () {
  "use strict";
  window.MG = window.MG || {};

  /* ---------------- 汎用ユーティリティ ---------------- */
  MG.escapeHtml = function (value) {
    if (value == null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  // 改行を <br> に（エスケープ済み文字列に対して使用）
  MG.nl2br = function (escaped) {
    return String(escaped == null ? "" : escaped).replace(/\n/g, "<br>");
  };

  MG.qs = function (name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) {
      return null;
    }
  };

  MG.formatNumber = function (n) {
    if (n == null || isNaN(n)) return "0";
    return Number(n).toLocaleString("ja-JP");
  };

  MG.formatDate = function (iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var y = d.getFullYear();
    var m = ("0" + (d.getMonth() + 1)).slice(-2);
    var day = ("0" + d.getDate()).slice(-2);
    var hh = ("0" + d.getHours()).slice(-2);
    var mm = ("0" + d.getMinutes()).slice(-2);
    return y + "年" + m + "月" + day + "日 " + hh + ":" + mm;
  };

  /* ---------------- アバター（頭文字） ---------------- */
  // ブランド配色（ネイビー×ゴールド系）で名前から決定的に生成
  var GRADS = [
    ["#2A3557", "#0E1428"],
    ["#3C3A2A", "#0E1428"],
    ["#2E4257", "#0A0E1A"],
    ["#4A3B22", "#141B33"],
    ["#243049", "#0A0E1A"],
  ];

  function hashString(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  MG.initials = function (name) {
    if (!name) return "";
    var parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) {
      return parts[0].charAt(0) + parts[1].charAt(0);
    }
    return parts[0].slice(0, 2);
  };

  // size: 'sm' | 'md' | 'lg'
  MG.avatarHTML = function (advisor, size) {
    var name = advisor && advisor.name ? advisor.name : "";
    var g = GRADS[hashString(name) % GRADS.length];
    var cls = "mg-avatar mg-avatar--" + (size || "md");
    var style =
      "background:linear-gradient(135deg," + g[0] + "," + g[1] + ");";
    return (
      '<span class="' + cls + '" style="' + style + '" aria-hidden="true">' +
      '<span class="mg-avatar__txt">' + MG.escapeHtml(MG.initials(name)) + "</span>" +
      "</span>"
    );
  };

  /* ---------------- 星評価 ---------------- */
  MG.starsHTML = function (rating) {
    var r = Math.max(0, Math.min(5, Number(rating) || 0));
    var full = Math.floor(r);
    var half = r - full >= 0.5;
    var stars = "";
    for (var i = 0; i < 5; i++) {
      var cls = "mg-star";
      if (i < full) cls += " is-full";
      else if (i === full && half) cls += " is-half";
      stars += '<span class="' + cls + '">★</span>';
    }
    return '<span class="mg-stars" role="img" aria-label="評価 ' + r.toFixed(1) + ' / 5">' + stars + "</span>";
  };

  /* ---------------- ヘッダー / フッター ---------------- */
  var BASE = "/platform";

  MG.renderChrome = function (active) {
    var nomCount = (MG.store ? MG.store.getNominations() : []).length;
    var badge = nomCount > 0 ? '<span class="mg-navbadge">' + nomCount + "</span>" : "";

    var headerEl = document.querySelector("[data-mg-header]");
    if (headerEl) {
      headerEl.className = "mg-header";
      headerEl.innerHTML =
        '<div class="mg-header__inner">' +
        '<a class="mg-brand" href="' + BASE + '/" aria-label="MarkGate ホームへ">' +
        '<span class="mg-brand__mark" aria-hidden="true">' + gateSvg() + "</span>" +
        '<span class="mg-brand__text"><span class="mg-brand__name">MarkGate</span>' +
        '<span class="mg-brand__sub">CAREER PLATFORM</span></span>' +
        "</a>" +
        '<nav class="mg-nav" aria-label="メインナビゲーション">' +
        navLink(BASE + "/advisors", "アドバイザーを探す", active === "advisors") +
        navLink(BASE + "/mypage", "マイページ" + badge, active === "mypage") +
        '<a class="mg-nav__corp" href="/">コーポレート</a>' +
        "</nav>" +
        '<button class="mg-nav-toggle" id="mgNavToggle" aria-label="メニュー" aria-expanded="false"><span></span><span></span><span></span></button>' +
        "</div>";

      var toggle = headerEl.querySelector("#mgNavToggle");
      var nav = headerEl.querySelector(".mg-nav");
      if (toggle && nav) {
        toggle.addEventListener("click", function () {
          var open = nav.classList.toggle("is-open");
          toggle.setAttribute("aria-expanded", String(open));
        });
      }
    }

    var footerEl = document.querySelector("[data-mg-footer]");
    if (footerEl) {
      footerEl.className = "mg-footer";
      footerEl.innerHTML =
        '<div class="mg-footer__inner">' +
        '<div class="mg-footer__brand"><span class="mg-brand__name">MarkGate</span>' +
        '<p class="mg-footer__tag">トップアドバイザーだけが、開ける扉。</p></div>' +
        '<nav class="mg-footer__nav" aria-label="フッターナビ">' +
        '<a href="' + BASE + '/">プラットフォーム入口</a>' +
        '<a href="' + BASE + '/advisors">アドバイザーを探す</a>' +
        '<a href="' + BASE + '/mypage">マイページ</a>' +
        '<a href="' + BASE + '/inbox">アドバイザー受信箱（デモ）</a>' +
        '<a href="/">コーポレートサイト</a>' +
        "</nav>" +
        "</div>" +
        '<div class="mg-footer__bottom"><p>&copy; ' + new Date().getFullYear() +
        " MarkGate Inc. ／ 本プラットフォームはデモ実装です。データはお使いのブラウザ内にのみ保存されます。</p></div>";
    }
  };

  function navLink(href, label, isActive) {
    return '<a class="mg-nav__link' + (isActive ? " is-active" : "") + '" href="' + href + '">' + label + "</a>";
  }

  function gateSvg() {
    return (
      '<svg viewBox="0 0 40 40" width="30" height="30" role="img" aria-hidden="true">' +
      '<defs><linearGradient id="mgG" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#E2C88A"/><stop offset="1" stop-color="#B8924A"/>' +
      "</linearGradient></defs>" +
      '<path d="M6 35 V14 L20 5 L34 14 V35" fill="none" stroke="url(#mgG)" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M14 35 V20 a6 6 0 0 1 12 0 V35" fill="none" stroke="url(#mgG)" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<line x1="3" y1="35" x2="37" y2="35" stroke="url(#mgG)" stroke-width="2.2" stroke-linecap="round"/></svg>'
    );
  }

  /* ---------------- トースト通知 ---------------- */
  MG.toast = function (message, type) {
    var wrap = document.querySelector(".mg-toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "mg-toast-wrap";
      document.body.appendChild(wrap);
    }
    var t = document.createElement("div");
    t.className = "mg-toast" + (type === "error" ? " is-error" : "");
    t.setAttribute("role", "status");
    t.textContent = message;
    wrap.appendChild(t);
    // フェードイン
    requestAnimationFrame(function () { t.classList.add("is-in"); });
    setTimeout(function () {
      t.classList.remove("is-in");
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400);
    }, 3600);
  };

  /* ---------------- mailto 生成（実際の連絡チャネル） ---------------- */
  MG.buildMailto = function (advisor, seeker, message) {
    var subject = "【MarkGate】指名のご連絡：" + (seeker.name || "求職者") + "様より";
    var lines = [
      advisor.name + " 様",
      "",
      "MarkGate経由で、あなたを担当アドバイザーに指名させていただきました。",
      "",
      "■ お名前：" + (seeker.name || "（未入力）"),
      "■ メール：" + (seeker.email || "（未入力）"),
      seeker.phone ? "■ 電話：" + seeker.phone : "",
      seeker.currentTitle ? "■ 現職：" + (seeker.currentCompany || "") + " " + seeker.currentTitle : "",
      "",
      "■ メッセージ：",
      message || "（メッセージなし）",
      "",
      "──────────",
      "MarkGate ハイクラス転職プラットフォーム",
    ].filter(function (l) { return l !== ""; }).join("\n");
    return (
      "mailto:" + (advisor.email || "") +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(lines)
    );
  };

  /* ---------------- 指名（nomination）モーダル ---------------- */
  // MG.openNominateModal(advisor, onSuccess)
  MG.openNominateModal = function (advisor, onSuccess) {
    if (!advisor) return;
    var existing = MG.store.getNomination(advisor.id);
    var profile = MG.store.getProfile();
    var seeker = profile.basics;
    var contactable = MG.store.isProfileContactable();

    var overlay = document.createElement("div");
    overlay.className = "mg-modal-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "mgModalTitle");

    var body;
    if (existing) {
      body =
        '<div class="mg-modal__body">' +
        '<p class="mg-modal__note">このアドバイザーは既に指名済みです（' + MG.formatDate(existing.createdAt) + "）。</p>" +
        '<div class="mg-modal__actions">' +
        '<a class="btn btn-outline-dark" href="' + BASE + '/mypage#nominations">指名履歴を見る</a>' +
        '<button type="button" class="btn btn-gold" data-mg-close>閉じる</button>' +
        "</div></div>";
    } else if (!contactable) {
      var nextUrl = BASE + "/mypage?next=" + encodeURIComponent(BASE + "/advisor?id=" + advisor.id);
      body =
        '<div class="mg-modal__body">' +
        '<p class="mg-modal__note"><strong>' + MG.escapeHtml(advisor.name) +
        '</strong> さんを指名するには、お名前とメールアドレスが必要です。まずマイページで基本情報をご入力ください（アドバイザーへの連絡に使用します）。入力・保存後、このアドバイザーの指名に戻れます。</p>' +
        '<div class="mg-modal__actions">' +
        '<a class="btn btn-gold" href="' + nextUrl + '">マイページで入力する</a>' +
        '<button type="button" class="btn btn-outline-dark" data-mg-close>閉じる</button>' +
        "</div></div>";
    } else {
      body =
        '<form class="mg-modal__body" id="mgNominateForm" novalidate>' +
        '<p class="mg-modal__note">以下の内容が <strong>' + MG.escapeHtml(advisor.name) + "</strong> さんに送信され、担当アドバイザーとして指名されます。</p>" +
        '<div class="mg-modal__seeker">' +
        "<span>" + MG.escapeHtml(seeker.name) + "</span>" +
        "<span>" + MG.escapeHtml(seeker.email) + "</span>" +
        (seeker.currentTitle ? "<span>" + MG.escapeHtml((seeker.currentCompany || "") + " " + seeker.currentTitle) + "</span>" : "") +
        "</div>" +
        '<label class="mg-field">' +
        "<span>アドバイザーへのメッセージ（任意）</span>" +
        '<textarea id="mgNomMsg" rows="4" placeholder="現在の状況や相談したいこと、希望条件などをお書きください。"></textarea>' +
        "</label>" +
        '<div class="mg-modal__actions">' +
        '<button type="button" class="btn btn-outline-dark" data-mg-close>キャンセル</button>' +
        '<button type="submit" class="btn btn-gold">この内容で指名する</button>' +
        "</div></form>";
    }

    overlay.innerHTML =
      '<div class="mg-modal">' +
      '<button class="mg-modal__x" type="button" aria-label="閉じる" data-mg-close>&times;</button>' +
      '<div class="mg-modal__head">' +
      MG.avatarHTML(advisor, "sm") +
      '<div><p class="mg-modal__eyebrow">指名する</p>' +
      '<h2 class="mg-modal__title" id="mgModalTitle">' + MG.escapeHtml(advisor.name) + "</h2>" +
      '<p class="mg-modal__sub">' + MG.escapeHtml(advisor.title) + " ／ " + MG.escapeHtml(advisor.agency) + "</p></div>" +
      "</div>" +
      body +
      "</div>";

    document.body.appendChild(overlay);
    document.body.classList.add("mg-modal-open");
    requestAnimationFrame(function () { overlay.classList.add("is-open"); });

    var lastFocused = document.activeElement;
    function close() {
      overlay.classList.remove("is-open");
      document.body.classList.remove("mg-modal-open");
      document.removeEventListener("keydown", onKey);
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 300);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
      if (e.target.closest("[data-mg-close]")) close();
    });

    // フォーカス移動
    var focusTarget = overlay.querySelector("textarea, .btn");
    if (focusTarget) focusTarget.focus();

    var form = overlay.querySelector("#mgNominateForm");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var msg = overlay.querySelector("#mgNomMsg").value.trim();
        var nom = MG.store.addNomination({
          advisorId: advisor.id,
          advisorName: advisor.name,
          advisorEmail: advisor.email,
          message: msg,
          seeker: {
            name: seeker.name,
            email: seeker.email,
            phone: seeker.phone,
            currentCompany: seeker.currentCompany,
            currentTitle: seeker.currentTitle,
          },
        });
        if (!nom) {
          MG.toast("保存に失敗しました。ブラウザの設定をご確認ください。", "error");
          return;
        }
        showSuccess(overlay, advisor, seeker, msg, close);
        if (typeof onSuccess === "function") onSuccess(nom);
      });
    }
  };

  function showSuccess(overlay, advisor, seeker, msg, close) {
    var modal = overlay.querySelector(".mg-modal");
    if (!modal) return;
    var mailto = MG.buildMailto(advisor, seeker, msg);
    modal.innerHTML =
      '<button class="mg-modal__x" type="button" aria-label="閉じる" data-mg-close>&times;</button>' +
      '<div class="mg-modal__success">' +
      '<div class="mg-modal__check" aria-hidden="true">✓</div>' +
      "<h2>指名の連絡を送信しました</h2>" +
      "<p><strong>" + MG.escapeHtml(advisor.name) + "</strong> さんに、あなたの指名が届きました。" +
      "通常 " + (advisor.stats ? advisor.stats.responseHours : 24) + " 時間以内に、アドバイザーよりご連絡があります。</p>" +
      '<div class="mg-modal__actions mg-modal__actions--stack">' +
      '<a class="btn btn-outline-dark" href="' + mailto + '">メールでも直接連絡する</a>' +
      '<a class="btn btn-outline-dark" href="' + BASE + '/inbox">アドバイザーに届いた内容を見る（デモ）</a>' +
      '<a class="btn btn-gold" href="' + BASE + '/mypage#nominations">指名履歴（マイページ）へ</a>' +
      "</div>" +
      '<p class="mg-modal__fineprint">※ 本デモでは連絡内容をブラウザ内に記録します。実運用ではアドバイザーへメール・通知が自動送信されます。</p>' +
      "</div>";
    // 再バインド（close は overlay のクリック委譲で処理されるため何もしなくてよい）
  }

  /* ---------------- アドバイザーカード（一覧・ダッシュボード共通） ---------------- */
  MG.advisorCardHTML = function (a) {
    var nominated = MG.store.hasNominated(a.id);
    var detail = BASE + "/advisor?id=" + encodeURIComponent(a.id);
    var tags = a.industries.slice(0, 2).concat([a.style]);
    var tagHtml = tags
      .map(function (t) { return '<span class="mg-tag">' + MG.escapeHtml(t) + "</span>"; })
      .join("");
    var badge = a.featured ? '<span class="mg-card__badge"><span class="mg-badge">注目</span></span>' : "";
    var nomBtn = nominated
      ? '<button class="btn btn-outline-dark btn-sm" disabled>指名済み</button>'
      : '<button class="btn btn-gold btn-sm" data-mg-nominate="' + MG.escapeHtml(a.id) + '">指名する</button>';
    return (
      '<article class="mg-card" data-advisor-id="' + MG.escapeHtml(a.id) + '">' +
      badge +
      '<div class="mg-card__top">' + MG.avatarHTML(a, "md") +
      '<div class="mg-card__id">' +
      '<h3 class="mg-card__name"><a href="' + detail + '">' + MG.escapeHtml(a.name) + "</a></h3>" +
      '<p class="mg-card__title">' + MG.escapeHtml(a.title) + "</p>" +
      '<p class="mg-card__agency">' + MG.escapeHtml(a.agency) + "</p>" +
      "</div></div>" +
      '<p class="mg-card__tagline">' + MG.escapeHtml(a.tagline) + "</p>" +
      '<div class="mg-card__tags">' + tagHtml + "</div>" +
      '<div class="mg-card__stats">' +
      '<div class="mg-card__stat"><b>' + MG.formatNumber(a.stats.placements) + "</b><span>支援実績</span></div>" +
      '<div class="mg-card__stat"><b>' + a.stats.satisfaction + "%</b><span>満足度</span></div>" +
      '<div class="mg-card__stat"><b>' + a.years + "年</b><span>経験</span></div>" +
      "</div>" +
      '<div class="mg-card__rating">' + MG.starsHTML(a.rating) +
      "<b>" + a.rating.toFixed(1) + "</b><span>（" + a.reviewCount + "件）</span></div>" +
      '<div class="mg-card__foot">' +
      '<a class="btn btn-outline-dark btn-sm" href="' + detail + '">プロフィール</a>' +
      nomBtn +
      "</div></article>"
    );
  };

  /* ---------------- 指名ボタンの委譲ハンドラ（全ページ共通） ---------------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("[data-mg-nominate]") : null;
    if (!btn) return;
    e.preventDefault();
    var id = btn.getAttribute("data-mg-nominate");
    var adv = MG.getAdvisor(id);
    if (!adv) return;
    MG.openNominateModal(adv, function (nom) {
      try {
        document.dispatchEvent(new CustomEvent("mg:nominated", { detail: { advisorId: id, nomination: nom } }));
      } catch (err) { /* CustomEvent 非対応環境は無視 */ }
    });
  });

  /* ---------------- 指名イベントでヘッダーの指名件数バッジ等を更新（全ページ共通） ---------------- */
  document.addEventListener("mg:nominated", function () {
    MG.renderChrome(document.body.getAttribute("data-mg-page") || "");
  });

  /* ---------------- 初期化 ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    var active = document.body.getAttribute("data-mg-page") || "";
    MG.renderChrome(active);
  });
})();
