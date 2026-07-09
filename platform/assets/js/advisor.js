/* =========================================================
   MarkGate Platform — アドバイザー個別プロフィール
   URL の ?id= からアドバイザーを取得し、全体を描画する。
   指名カードは指名成功イベントを購読して「指名済み」表示へ再描画。
   ========================================================= */
(function () {
  "use strict";

  var BASE = "/platform";

  document.addEventListener("DOMContentLoaded", function () {
    var host = document.getElementById("mgProfile");
    if (!host || !window.MG) return;

    var esc = MG.escapeHtml;
    var id = MG.qs("id");
    var adv = MG.getAdvisor(id);

    /* ---------- 見つからない場合 ---------- */
    if (!adv) {
      document.title = "アドバイザーが見つかりません ｜MarkGate";
      host.innerHTML =
        '<div class="mg-empty">' +
        '<div class="mg-empty__icon" aria-hidden="true">✕</div>' +
        "<h3>アドバイザーが見つかりません</h3>" +
        "<p>お探しのアドバイザーは存在しないか、URLが正しくない可能性があります。</p>" +
        '<a class="btn btn-gold" href="' + BASE + '/advisors">一覧に戻る</a>' +
        "</div>";
      return;
    }

    /* ---------- タイトル / パンくず ---------- */
    document.title = adv.name + " ｜MarkGate";
    var crumbName = document.getElementById("mgCrumbName");
    if (crumbName) crumbName.textContent = adv.name;

    /* ---------- 部品ビルダー ---------- */
    function tagList(items, cls) {
      return (items || [])
        .map(function (t) {
          return '<span class="' + cls + '">' + esc(t) + "</span>";
        })
        .join("");
    }

    function bioHTML() {
      return String(adv.bio || "")
        .split("\n")
        .map(function (p) { return p.trim(); })
        .filter(function (p) { return p.length > 0; })
        .map(function (p) { return "<p>" + esc(p) + "</p>"; })
        .join("");
    }

    function strengthsHTML() {
      return (adv.strengths || [])
        .map(function (s) {
          return '<div class="mg-deflist__row"><span>' + esc(s) + "</span></div>";
        })
        .join("");
    }

    function reviewsHTML() {
      if (!adv.reviews || !adv.reviews.length) return "";
      var items = adv.reviews
        .map(function (r) {
          return (
            '<div class="mg-review">' +
            '<div class="mg-review__head">' +
            '<span class="mg-review__who">' + esc(r.role) +
            "<span>" + esc(r.industry) + "</span></span>" +
            MG.starsHTML(r.rating) +
            "</div>" +
            '<p class="mg-review__text">' + esc(r.text) + "</p>" +
            "</div>"
          );
        })
        .join("");
      return (
        '<section class="mg-section">' +
        '<h2 class="mg-section__title">求職者の声</h2>' +
        items +
        "</section>"
      );
    }

    function heroHTML() {
      var meta =
        tagList(adv.salaryBands, "mg-tag mg-tag--gold") +
        tagList(adv.languages, "mg-tag");
      var ratingline =
        '<div class="mg-profile__ratingline">' +
        MG.starsHTML(adv.rating) +
        "<b>" + esc(String(adv.rating)) + "</b>" +
        "<span>（" + MG.formatNumber(adv.reviewCount) + "件のレビュー）・経験" +
        esc(String(adv.years)) + "年</span>" +
        "</div>";
      return (
        '<div class="mg-profile__hero">' +
        MG.avatarHTML(adv, "lg") +
        '<div class="mg-profile__ident">' +
        '<h1 class="mg-profile__name">' + esc(adv.name) + "</h1>" +
        '<p class="mg-profile__kana">' + esc(adv.kana) + "</p>" +
        '<p class="mg-profile__title">' + esc(adv.title) + "</p>" +
        '<p class="mg-profile__agency">' + esc(adv.agency) + "</p>" +
        '<div class="mg-profile__meta">' + meta + "</div>" +
        ratingline +
        "</div>" +
        "</div>"
      );
    }

    function mainHTML() {
      return (
        "<div>" +
        heroHTML() +
        '<section class="mg-section">' +
        '<h2 class="mg-section__title">自己紹介</h2>' +
        '<div class="mg-bio">' + bioHTML() + "</div>" +
        "</section>" +
        '<section class="mg-section">' +
        '<h2 class="mg-section__title">得意領域・専門性</h2>' +
        '<div class="mg-pilllist">' + tagList(adv.specialties, "mg-tag mg-tag--gold") + "</div>" +
        "</section>" +
        '<section class="mg-section">' +
        '<h2 class="mg-section__title">強み</h2>' +
        '<div class="mg-deflist">' + strengthsHTML() + "</div>" +
        "</section>" +
        '<section class="mg-section">' +
        '<h2 class="mg-section__title">対応領域</h2>' +
        '<div class="mg-pilllist">' +
        tagList((adv.industries || []).concat(adv.jobTypes || []), "mg-tag") +
        "</div>" +
        "</section>" +
        reviewsHTML() +
        "</div>"
      );
    }

    function ctaHTML() {
      if (MG.store.hasNominated(adv.id)) {
        return (
          '<div class="mg-cta-card is-nominated">' +
          '<div class="mg-cta-status">✓ 指名済みです</div>' +
          '<a class="btn btn-gold" href="' + BASE + '/mypage#nominations">指名履歴を見る</a>' +
          "</div>"
        );
      }
      return (
        '<div class="mg-cta-card">' +
        '<p class="mg-cta-card__title">このアドバイザーを指名する</p>' +
        '<p class="mg-cta-card__desc">あなたのプロフィールとメッセージを添えて、担当アドバイザーとして指名できます。</p>' +
        '<button class="btn btn-gold" data-mg-nominate="' + esc(adv.id) + '">指名する</button>' +
        '<p class="mg-cta-card__note">指名するとアドバイザーへ連絡が届きます。通常 ' +
        esc(String(adv.stats ? adv.stats.responseHours : 24)) +
        " 時間以内にご返信があります。</p>" +
        "</div>"
      );
    }

    function metaRow(dt, dd) {
      return "<dt>" + esc(dt) + "</dt><dd>" + esc(dd) + "</dd>";
    }

    function metaCardHTML() {
      var s = adv.stats || {};
      return (
        '<div class="mg-meta-card">' +
        "<h3>アドバイザー情報</h3>" +
        "<dl>" +
        metaRow("所属", adv.agency) +
        metaRow("経験", adv.years + "年") +
        metaRow("対応年収", (adv.salaryBands || []).join("・")) +
        metaRow("対応地域", (adv.regions || []).join("・")) +
        metaRow("言語", (adv.languages || []).join("・")) +
        metaRow("支援スタンス", adv.style) +
        metaRow("平均返信", (s.responseHours != null ? s.responseHours : "-") + "時間以内") +
        "</dl>" +
        "</div>"
      );
    }

    function asideHTML() {
      return (
        '<aside class="mg-aside">' +
        '<div id="mgCtaCard">' + ctaHTML() + "</div>" +
        metaCardHTML() +
        "</aside>"
      );
    }

    /* ---------- 初回描画 ---------- */
    host.innerHTML = '<div class="mg-profile">' + mainHTML() + asideHTML() + "</div>";

    /* ---------- 指名成功時に指名カードを再描画 ---------- */
    document.addEventListener("mg:nominated", function (e) {
      if (!e.detail || e.detail.advisorId !== adv.id) return;
      var cta = document.getElementById("mgCtaCard");
      if (cta) cta.innerHTML = ctaHTML();
    });
  });
})();
