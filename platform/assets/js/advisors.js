/* =========================================================
   MarkGate Platform — アドバイザー検索・一覧 コントローラ
   MG.taxonomy から絞り込みUIを構築し、MG.advisors を
   フィルタ／並び替え／キーワード検索して MG.advisorCardHTML で描画します。
   状態は querystring に同期し、リロードや共有時に復元します。
   ========================================================= */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.MG || !MG.taxonomy || !MG.advisors) return;

    /* ---- 絞り込みカテゴリ定義（taxonomy キー → 見出し／項目） ---- */
    var CATEGORIES = [
      { key: "industries", title: "業界", items: MG.taxonomy.industries || [] },
      { key: "jobTypes", title: "職種", items: MG.taxonomy.jobTypes || [] },
      { key: "salaryBands", title: "対応年収", items: MG.taxonomy.salaryBands || [] },
      { key: "regions", title: "対応地域", items: MG.taxonomy.regions || [] },
      { key: "styles", title: "支援スタンス", items: MG.taxonomy.styles || [] },
    ];
    var VALID_SORTS = ["recommended", "rating", "placements", "years"];

    /* ---- フィルタ状態 ---- */
    var state = {
      industries: new Set(),
      jobTypes: new Set(),
      salaryBands: new Set(),
      regions: new Set(),
      styles: new Set(),
      keyword: "",
      sort: "recommended",
    };

    /* ---- 参照 ---- */
    var groupsEl = document.getElementById("mgFilterGroups");
    var resultsEl = document.getElementById("mgResults");
    var countEl = document.getElementById("mgCount");
    var chipsEl = document.getElementById("mgChips");
    var searchEl = document.getElementById("mgSearch");
    var sortEl = document.getElementById("mgSort");
    var clearEl = document.getElementById("mgClear");
    var toggleEl = document.getElementById("mgFilterToggle");
    var doneEl = document.getElementById("mgFiltersDone");
    var filtersEl = document.getElementById("mgFilters");

    if (!groupsEl || !resultsEl) return;

    /* ---- URL から状態を復元 ---- */
    restoreFromURL();

    /* ---- 絞り込みグループ描画 ---- */
    function renderGroups() {
      groupsEl.innerHTML = CATEGORIES.map(function (cat) {
        var checks = cat.items
          .map(function (item) {
            var esc = MG.escapeHtml(item);
            var checked = state[cat.key].has(item) ? " checked" : "";
            return (
              '<label class="mg-check">' +
              '<input type="checkbox" data-cat="' + cat.key + '" value="' + esc + '"' + checked + ">" +
              "<span>" + esc + "</span></label>"
            );
          })
          .join("");
        return (
          '<div class="mg-fgroup">' +
          '<div class="mg-fgroup__title">' + MG.escapeHtml(cat.title) + "</div>" +
          checks +
          "</div>"
        );
      }).join("");
    }

    /* ---- 絞り込みロジック（カテゴリ内OR・カテゴリ間AND） ---- */
    function hasAny(arr, set) {
      if (!arr) return false;
      for (var i = 0; i < arr.length; i++) {
        if (set.has(arr[i])) return true;
      }
      return false;
    }

    function matches(a) {
      if (state.industries.size && !hasAny(a.industries, state.industries)) return false;
      if (state.jobTypes.size && !hasAny(a.jobTypes, state.jobTypes)) return false;
      if (state.salaryBands.size && !hasAny(a.salaryBands, state.salaryBands)) return false;
      if (state.regions.size && !hasAny(a.regions, state.regions)) return false;
      if (state.styles.size && !state.styles.has(a.style)) return false;
      if (state.keyword) {
        var kw = state.keyword.toLowerCase();
        var hay = [
          a.name,
          a.kana,
          a.title,
          a.agency,
          a.tagline,
          (a.specialties || []).join(" "),
          (a.industries || []).join(" "),
          (a.jobTypes || []).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (hay.indexOf(kw) === -1) return false;
      }
      return true;
    }

    /* ---- 並び替え ---- */
    function sortList(list) {
      var s = state.sort;
      return list.slice().sort(function (a, b) {
        if (s === "rating") return b.rating - a.rating;
        if (s === "placements") return b.stats.placements - a.stats.placements;
        if (s === "years") return b.years - a.years;
        // recommended: 注目を優先 → 評価降順
        var fa = a.featured ? 1 : 0;
        var fb = b.featured ? 1 : 0;
        if (fb !== fa) return fb - fa;
        return b.rating - a.rating;
      });
    }

    /* ---- 結果・件数・チップ描画 ---- */
    function renderResults(list) {
      if (!list.length) {
        resultsEl.innerHTML =
          '<div class="mg-empty">' +
          '<div class="mg-empty__icon" aria-hidden="true">◇</div>' +
          "<h3>条件に合うアドバイザーが見つかりません</h3>" +
          "<p>条件を変更してお試しください。</p>" +
          '<button class="btn btn-gold" id="mgEmptyClear" type="button">条件をクリア</button>' +
          "</div>";
        var ec = document.getElementById("mgEmptyClear");
        if (ec) ec.addEventListener("click", clearAll);
        return;
      }
      resultsEl.innerHTML = list
        .map(function (a) {
          return MG.advisorCardHTML(a);
        })
        .join("");
    }

    function renderCount(n) {
      if (countEl) countEl.innerHTML = "<b>" + n + "</b> 名";
    }

    function renderChips() {
      if (!chipsEl) return;
      var html = "";
      CATEGORIES.forEach(function (cat) {
        state[cat.key].forEach(function (val) {
          var esc = MG.escapeHtml(val);
          html +=
            '<span class="mg-chip">' + esc +
            ' <button type="button" aria-label="解除" data-chip-cat="' + cat.key + '" data-chip-val="' + esc + '">×</button>' +
            "</span>";
        });
      });
      if (state.keyword) {
        var kwEsc = MG.escapeHtml("キーワード：" + state.keyword);
        html +=
          '<span class="mg-chip">' + kwEsc +
          ' <button type="button" aria-label="解除" data-chip-kw="1">×</button></span>';
      }
      chipsEl.innerHTML = html;
    }

    /* ---- URL 同期 ---- */
    function syncURL() {
      var params = new URLSearchParams();
      CATEGORIES.forEach(function (cat) {
        if (state[cat.key].size) {
          params.set(cat.key, Array.from(state[cat.key]).join(","));
        }
      });
      if (state.keyword) params.set("q", state.keyword);
      if (state.sort && state.sort !== "recommended") params.set("sort", state.sort);
      var qs = params.toString();
      var url = window.location.pathname + (qs ? "?" + qs : "");
      try {
        history.replaceState(null, "", url);
      } catch (e) {
        /* noop */
      }
    }

    function restoreFromURL() {
      var params;
      try {
        params = new URLSearchParams(window.location.search);
      } catch (e) {
        return;
      }
      CATEGORIES.forEach(function (cat) {
        var raw = params.get(cat.key);
        if (!raw) return;
        raw.split(",").forEach(function (v) {
          v = v.trim();
          if (v && cat.items.indexOf(v) !== -1) state[cat.key].add(v);
        });
      });
      var q = params.get("q");
      if (q) {
        state.keyword = q.trim();
        if (searchEl) searchEl.value = state.keyword;
      }
      var sort = params.get("sort");
      if (sort && VALID_SORTS.indexOf(sort) !== -1) {
        state.sort = sort;
        if (sortEl) sortEl.value = sort;
      }
    }

    /* ---- メイン適用 ---- */
    function apply() {
      var list = sortList(MG.advisors.filter(matches));
      renderResults(list);
      renderCount(list.length);
      renderChips();
      syncURL();
    }

    /* ---- クリア（全解除） ---- */
    function clearAll() {
      CATEGORIES.forEach(function (cat) {
        state[cat.key].clear();
      });
      state.keyword = "";
      if (searchEl) searchEl.value = "";
      renderGroups();
      apply();
    }

    /* ---- イベント ---- */
    // チェックボックス変更（#mgFilterGroups への委譲）
    groupsEl.addEventListener("change", function (e) {
      var cb = e.target;
      if (!cb || cb.type !== "checkbox") return;
      var cat = cb.getAttribute("data-cat");
      if (!cat || !state[cat]) return;
      if (cb.checked) state[cat].add(cb.value);
      else state[cat].delete(cb.value);
      apply();
    });

    // アクティブチップの解除
    if (chipsEl) {
      chipsEl.addEventListener("click", function (e) {
        var btn = e.target.closest ? e.target.closest("button") : null;
        if (!btn) return;
        if (btn.hasAttribute("data-chip-kw")) {
          state.keyword = "";
          if (searchEl) searchEl.value = "";
          apply();
          return;
        }
        var cat = btn.getAttribute("data-chip-cat");
        var val = btn.getAttribute("data-chip-val");
        if (cat && state[cat]) {
          state[cat].delete(val);
          renderGroups();
          apply();
        }
      });
    }

    // キーワード検索
    if (searchEl) {
      searchEl.addEventListener("input", function () {
        state.keyword = searchEl.value.trim();
        apply();
      });
    }

    // 並び替え
    if (sortEl) {
      sortEl.addEventListener("change", function () {
        state.sort = VALID_SORTS.indexOf(sortEl.value) !== -1 ? sortEl.value : "recommended";
        apply();
      });
    }

    // クリアボタン
    if (clearEl) clearEl.addEventListener("click", clearAll);

    // モバイル: 絞り込みドロワー開閉
    if (toggleEl && filtersEl) {
      toggleEl.addEventListener("click", function () {
        filtersEl.classList.add("is-open");
        toggleEl.setAttribute("aria-expanded", "true");
      });
    }
    if (doneEl && filtersEl) {
      doneEl.addEventListener("click", function () {
        filtersEl.classList.remove("is-open");
        if (toggleEl) toggleEl.setAttribute("aria-expanded", "false");
      });
    }

    // 指名成功時に再描画（「指名済み」表示へ反映）
    document.addEventListener("mg:nominated", function () {
      apply();
    });

    /* ---- 初期描画 ---- */
    renderGroups();
    apply();
  });
})();
