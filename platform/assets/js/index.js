/* =========================================================
   MarkGate Platform — ダッシュボード（プラットフォーム入口）
   注目アドバイザーを描画し、指名成功イベントで再描画する。
   ========================================================= */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var host = document.getElementById("mgFeatured");
    if (!host || !window.MG || !Array.isArray(MG.advisors)) return;

    // featured を優先し、3件に満たない場合は rating 降順で補完する
    function pickFeatured() {
      var featured = MG.advisors.filter(function (a) { return a.featured; });
      if (featured.length < 3) {
        var extras = MG.advisors
          .filter(function (a) { return !a.featured; })
          .sort(function (x, y) { return (y.rating || 0) - (x.rating || 0); });
        featured = featured.concat(extras);
      }
      return featured.slice(0, 3);
    }

    var list = pickFeatured();

    function render() {
      host.innerHTML = list
        .map(function (a) { return MG.advisorCardHTML(a); })
        .join("");
    }

    render();

    // 指名済み表示へ切り替えるため、指名成功を購読して再描画
    document.addEventListener("mg:nominated", render);
  });
})();
