/* =========================================================
   MarkGate Platform — アドバイザー受信箱（デモ） コントローラ
   MG.store.getInboxByAdvisor() で「アドバイザー別に届いた指名」を
   取り出し、送信者（求職者）視点の情報を表示します。
   ※本デモではブラウザ内に記録された指名のみを表示します。
     実運用ではアドバイザー本人にのみメール／通知で届きます。
   ========================================================= */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.MG || !MG.store) return;

    var inboxEl = document.getElementById("mgInbox");
    if (!inboxEl) return;

    /* ---- 空状態 ---- */
    function emptyHTML() {
      return (
        '<div class="mg-empty">' +
        '<div class="mg-empty__icon" aria-hidden="true">✉</div>' +
        "<h3>まだ指名は届いていません</h3>" +
        "<p>アドバイザーを指名すると、ここに届いた内容が表示されます。</p>" +
        '<a class="btn btn-gold" href="/platform/advisors">アドバイザーを探す</a>' +
        "</div>"
      );
    }

    /* ---- 1件の指名（求職者＝送信者視点で描画） ---- */
    function nomHTML(nom) {
      var seeker = nom.seeker || {};

      // 連絡先メタ: 日時 ・ 連絡先メール（電話／現職があれば併記）
      var metaParts = [
        MG.formatDate(nom.createdAt),
        "連絡先: " + MG.escapeHtml(seeker.email || "（未入力）"),
      ];
      if (seeker.phone) metaParts.push(MG.escapeHtml(seeker.phone));
      if (seeker.currentTitle || seeker.currentCompany) {
        var current = ((seeker.currentCompany || "") + " " + (seeker.currentTitle || "")).trim();
        if (current) metaParts.push(MG.escapeHtml(current));
      }

      var msgHtml = nom.message
        ? '<p class="mg-nom__msg">' + MG.nl2br(MG.escapeHtml(nom.message)) + "</p>"
        : "";

      return (
        '<div class="mg-nom">' +
        MG.avatarHTML({ name: seeker.name || "求職者" }, "sm") +
        '<div class="mg-nom__body">' +
        '<div class="mg-nom__top">' +
        '<span class="mg-nom__name">' + MG.escapeHtml(seeker.name || "求職者") + " さんより指名</span>" +
        '<span class="mg-status">' + MG.escapeHtml(nom.status || "連絡済み") + "</span>" +
        "</div>" +
        '<p class="mg-nom__meta">' + metaParts.join(" ・ ") + "</p>" +
        msgHtml +
        "</div>" +
        "</div>"
      );
    }

    /* ---- アドバイザー単位のグループ ---- */
    function groupHTML(advisorId, noms) {
      var adv = MG.getAdvisor(advisorId);
      var headTarget = adv || { name: noms[0].advisorName };
      var displayName = adv ? adv.name : noms[0].advisorName;
      var sub = (adv ? MG.escapeHtml(adv.agency) + "・" : "") + noms.length + "件の指名";

      return (
        '<div class="mg-inbox-group">' +
        '<div class="mg-inbox-group__head">' +
        MG.avatarHTML(headTarget, "sm") +
        "<div>" +
        '<div class="mg-inbox-group__name">' + MG.escapeHtml(displayName) + " 宛</div>" +
        '<div class="mg-inbox-group__sub">' + sub + "</div>" +
        "</div>" +
        "</div>" +
        noms
          .map(function (nom) {
            return nomHTML(nom);
          })
          .join("") +
        "</div>"
      );
    }

    /* ---- 描画 ---- */
    function render() {
      var map = MG.store.getInboxByAdvisor();
      var ids = Object.keys(map);
      if (!ids.length) {
        inboxEl.innerHTML = emptyHTML();
        return;
      }
      inboxEl.innerHTML = ids
        .map(function (advisorId) {
          return groupHTML(advisorId, map[advisorId]);
        })
        .join("");
    }

    /* ---- 指名成功時に再描画（このページで指名が起きることは稀だが一貫性のため） ---- */
    document.addEventListener("mg:nominated", function () {
      render();
    });

    /* ---- 初期描画 ---- */
    render();
  });
})();
