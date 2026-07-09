/* =========================================================
   MarkGate Platform — マイページ コントローラ
   求職者プロフィール（基本情報・職務要約・職務経歴・学歴・
   スキル/資格・希望条件）の編集と localStorage への保存、
   および指名履歴の表示・取り消しを担います。
   状態は MG.store 経由で保存し、進捗バーは現在のDOM値から算出します。
   ========================================================= */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.MG || !MG.store) return;

    var esc = MG.escapeHtml;
    var profile = MG.store.getProfile();

    // 未入力ユーザーが指名モーダル経由で来た場合の戻り先（内部パスのみ許可）
    var safeNext = (function () {
      var n = MG.qs("next");
      return n && /^\/platform\//.test(n) ? n : "";
    })();

    /* ---- 参照 ---- */
    var form = document.getElementById("mgForm");
    var workList = document.getElementById("mgWorkList");
    var eduList = document.getElementById("mgEduList");
    var skillsBox = document.getElementById("mgSkills");
    var certsBox = document.getElementById("mgCerts");
    var jobTypesBox = document.getElementById("mgJobTypes");
    var industriesBox = document.getElementById("mgIndustries");
    var locationsBox = document.getElementById("mgLocations");
    var summaryEl = document.getElementById("mgSummary");
    var salaryEl = document.getElementById("mgSalaryMin");
    var workStyleEl = document.getElementById("mgWorkStyle");
    var timingEl = document.getElementById("mgTiming");
    var notesEl = document.getElementById("mgNotes");
    var progressBar = document.getElementById("mgProgressBar");
    var progressVal = document.getElementById("mgProgressVal");
    var saveStatus = document.getElementById("mgSaveStatus");
    var clearBtn = document.getElementById("mgClearBtn");
    var nomList = document.getElementById("mgNomList");

    if (!form) return;

    /* chips の状態（配列を参照で保持し collect() から直接読む） */
    var skills = Array.isArray(profile.skills) ? profile.skills.slice() : [];
    var certs = Array.isArray(profile.certifications) ? profile.certifications.slice() : [];

    /* ---------------- フィールド構築ヘルパ ---------------- */
    function field(label, key, value, placeholder) {
      return (
        '<label class="mg-field"><span>' + esc(label) + "</span>" +
        '<input type="text" data-field="' + esc(key) + '"' +
        (placeholder ? ' placeholder="' + esc(placeholder) + '"' : "") +
        ' value="' + esc(value || "") + '" /></label>'
      );
    }
    function fieldArea(label, key, value) {
      return (
        '<label class="mg-field"><span>' + esc(label) + "</span>" +
        '<textarea data-field="' + esc(key) + '" rows="3">' + esc(value || "") + "</textarea></label>"
      );
    }

    function workRowHTML(w) {
      w = w || {};
      return (
        '<div class="mg-repeat__item">' +
        '<button type="button" class="mg-repeat__remove">× 削除</button>' +
        '<div class="mg-grid2">' +
        field("会社名", "company", w.company) +
        field("役職", "title", w.title) +
        "</div>" +
        field("期間", "period", w.period, "例：2019.04–2023.03") +
        fieldArea("業務内容", "description", w.description) +
        "</div>"
      );
    }

    function eduRowHTML(e) {
      e = e || {};
      return (
        '<div class="mg-repeat__item">' +
        '<button type="button" class="mg-repeat__remove">× 削除</button>' +
        '<div class="mg-grid2">' +
        field("学校名", "school", e.school) +
        field("学位・課程", "degree", e.degree) +
        "</div>" +
        '<div class="mg-grid2">' +
        field("専攻", "field", e.field) +
        field("期間", "period", e.period, "例：2011.04–2015.03") +
        "</div>" +
        "</div>"
      );
    }

    /* ---------------- 初期反映 ---------------- */
    function setBasics() {
      var inputs = form.querySelectorAll("[data-basic]");
      Array.prototype.forEach.call(inputs, function (el) {
        var k = el.getAttribute("data-basic");
        if (profile.basics[k] != null) el.value = profile.basics[k];
      });
    }

    function renderWork() {
      var arr = profile.workHistory && profile.workHistory.length ? profile.workHistory : [{}];
      workList.innerHTML = arr.map(workRowHTML).join("");
    }
    function renderEdu() {
      var arr = profile.education && profile.education.length ? profile.education : [{}];
      eduList.innerHTML = arr.map(eduRowHTML).join("");
    }

    function renderPillcheck(box, items, selected) {
      if (!box) return;
      var sel = selected || [];
      box.innerHTML = (items || [])
        .map(function (item) {
          var e = esc(item);
          var checked = sel.indexOf(item) !== -1 ? " checked" : "";
          return '<label><input type="checkbox" value="' + e + '"' + checked + "><span>" + e + "</span></label>";
        })
        .join("");
    }

    /* ---------------- chips 入力（スキル / 資格） ---------------- */
    function renderChipsBox(box, arr) {
      var existing = box.querySelectorAll(".mg-chipsinput__tag");
      Array.prototype.forEach.call(existing, function (t) {
        if (t.parentNode) t.parentNode.removeChild(t);
      });
      var input = box.querySelector("input");
      arr.forEach(function (val, idx) {
        var span = document.createElement("span");
        span.className = "mg-chipsinput__tag";
        span.innerHTML = esc(val) + '<button type="button" aria-label="削除" data-idx="' + idx + '">×</button>';
        box.insertBefore(span, input);
      });
    }

    function addChip(box, arr, raw) {
      var v = (raw || "").trim();
      if (!v) return;
      if (arr.indexOf(v) !== -1) return;
      arr.push(v);
      renderChipsBox(box, arr);
      updateProgress();
    }

    function bindChips(box, arr) {
      var input = box.querySelector("input");
      if (!input) return;
      input.addEventListener("keydown", function (e) {
        if (e.isComposing) return; // IME変換中は無視
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          addChip(box, arr, input.value);
          input.value = "";
        } else if (e.key === "Backspace" && input.value === "" && arr.length) {
          arr.pop();
          renderChipsBox(box, arr);
          updateProgress();
        }
      });
      // カンマを含む入力（ペースト等）のフォールバック
      input.addEventListener("input", function () {
        if (input.value.indexOf(",") !== -1) {
          input.value.split(",").forEach(function (p) {
            addChip(box, arr, p);
          });
          input.value = "";
        }
      });
      box.addEventListener("click", function (e) {
        var btn = e.target.closest ? e.target.closest("button") : null;
        if (!btn) {
          if (e.target === box) input.focus();
          return;
        }
        var idx = parseInt(btn.getAttribute("data-idx"), 10);
        if (!isNaN(idx)) {
          arr.splice(idx, 1);
          renderChipsBox(box, arr);
          updateProgress();
        }
      });
    }

    /* ---------------- 収集（DOM → profile） ---------------- */
    function getChecked(box) {
      if (!box) return [];
      return Array.prototype.map.call(box.querySelectorAll("input:checked"), function (cb) {
        return cb.value;
      });
    }

    function collectRepeat(list, fields) {
      var out = [];
      var items = list.querySelectorAll(".mg-repeat__item");
      Array.prototype.forEach.call(items, function (item) {
        var obj = {};
        var empty = true;
        fields.forEach(function (f) {
          var el = item.querySelector('[data-field="' + f + '"]');
          var v = el ? el.value.trim() : "";
          obj[f] = v;
          if (v) empty = false;
        });
        if (!empty) out.push(obj); // 全項目空の行は除外
      });
      return out;
    }

    function collect() {
      var basics = {};
      var binputs = form.querySelectorAll("[data-basic]");
      Array.prototype.forEach.call(binputs, function (el) {
        basics[el.getAttribute("data-basic")] = el.value.trim();
      });
      return {
        basics: basics,
        summary: summaryEl.value.trim(),
        workHistory: collectRepeat(workList, ["company", "title", "period", "description"]),
        education: collectRepeat(eduList, ["school", "degree", "field", "period"]),
        skills: skills.slice(),
        certifications: certs.slice(),
        desired: {
          jobTypes: getChecked(jobTypesBox),
          industries: getChecked(industriesBox),
          salaryMin: salaryEl.value.trim(),
          locations: getChecked(locationsBox),
          workStyle: workStyleEl.value.trim(),
          timing: timingEl.value,
          notes: notesEl.value.trim(),
        },
      };
    }

    /* ---------------- 進捗バー（store.profileCompleteness と同基準） ---------------- */
    function completeness(p) {
      // 判定基準は store と共通（入力中のDOM値から算出）
      return MG.store.completenessOf(p);
    }

    function updateProgress() {
      var pct = completeness(collect());
      progressBar.style.width = pct + "%";
      progressVal.textContent = pct + "%";
    }

    /* ---------------- 行の追加 / 削除 ---------------- */
    var addBtns = document.querySelectorAll("[data-add]");
    Array.prototype.forEach.call(addBtns, function (btn) {
      btn.addEventListener("click", function () {
        if (btn.getAttribute("data-add") === "work") {
          workList.insertAdjacentHTML("beforeend", workRowHTML());
        } else {
          eduList.insertAdjacentHTML("beforeend", eduRowHTML());
        }
        updateProgress();
      });
    });

    function bindRemove(list) {
      list.addEventListener("click", function (e) {
        var btn = e.target.closest ? e.target.closest(".mg-repeat__remove") : null;
        if (!btn) return;
        var item = btn.closest(".mg-repeat__item");
        if (item && item.parentNode) item.parentNode.removeChild(item);
        updateProgress();
      });
    }

    /* ---------------- 保存 ---------------- */
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = collect();
      var saved = MG.store.saveProfile(data);
      if (!saved) {
        MG.toast("保存に失敗しました。ブラウザの設定をご確認ください。", "error");
        return;
      }
      profile = MG.store.getProfile();
      var now = new Date();
      var hh = ("0" + now.getHours()).slice(-2);
      var mm = ("0" + now.getMinutes()).slice(-2);
      var msg = "保存しました（" + hh + ":" + mm + "）";
      if (!data.basics.name || !data.basics.email) {
        msg += "　※指名にはお名前とメールが必要です";
      }
      if (safeNext && data.basics.name && data.basics.email) {
        saveStatus.innerHTML = esc(msg) + ' <a class="mg-savebar__return" href="' + safeNext + '">指名に戻る →</a>';
      } else {
        saveStatus.textContent = msg;
      }
      saveStatus.classList.add("is-saved");
      MG.toast("プロフィールを保存しました。");
      updateProgress();
    });

    /* ---------------- クリア ---------------- */
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (window.confirm("入力内容をすべて消去します。よろしいですか？")) {
          MG.store.clearAll();
          window.location.reload();
        }
      });
    }

    /* ---------------- 指名履歴 ---------------- */
    function renderNoms() {
      var list = MG.store.getNominations();
      if (!list.length) {
        nomList.innerHTML =
          '<div class="mg-empty">' +
          '<div class="mg-empty__icon" aria-hidden="true">◇</div>' +
          "<h3>まだ指名していません</h3>" +
          "<p>気になるアドバイザーを見つけて、指名してみましょう。</p>" +
          '<a class="btn btn-gold" href="/platform/advisors">アドバイザーを探す</a>' +
          "</div>";
        return;
      }
      nomList.innerHTML = list
        .map(function (nom) {
          var detail = "/platform/advisor?id=" + encodeURIComponent(nom.advisorId);
          var message = nom.message
            ? '<p class="mg-nom__msg">' + MG.nl2br(esc(nom.message)) + "</p>"
            : "";
          return (
            '<div class="mg-nom">' +
            MG.avatarHTML({ name: nom.advisorName }, "sm") +
            '<div class="mg-nom__body">' +
            '<div class="mg-nom__top">' +
            '<span class="mg-nom__name"><a href="' + detail + '">' + esc(nom.advisorName) + "</a></span>" +
            '<span class="mg-status">' + esc(nom.status) + "</span>" +
            "</div>" +
            '<p class="mg-nom__meta">' + esc(MG.formatDate(nom.createdAt)) + "</p>" +
            message +
            '<div class="mg-nom__actions">' +
            '<a class="btn btn-outline-dark btn-sm" href="' + detail + '">プロフィール</a>' +
            '<button class="mg-linkbtn" type="button" data-cancel="' + esc(nom.id) + '">指名を取り消す</button>' +
            "</div>" +
            "</div></div>"
          );
        })
        .join("");
    }

    if (nomList) {
      nomList.addEventListener("click", function (e) {
        var btn = e.target.closest ? e.target.closest("[data-cancel]") : null;
        if (!btn) return;
        var id = btn.getAttribute("data-cancel");
        if (!window.confirm("この指名を取り消しますか？")) return;
        if (MG.store.cancelNomination(id)) {
          renderNoms();
          MG.renderChrome(document.body.getAttribute("data-mg-page") || "");
          MG.toast("指名を取り消しました。");
        } else {
          MG.toast("取り消しに失敗しました。", "error");
        }
      });
    }

    // 指名成功時（他ページからの遷移直後など）に履歴とバッジを更新
    document.addEventListener("mg:nominated", function () {
      renderNoms();
      MG.renderChrome(document.body.getAttribute("data-mg-page") || "");
    });

    /* ---------------- 進捗の再計算トリガ ---------------- */
    form.addEventListener("input", updateProgress);
    form.addEventListener("change", updateProgress);

    /* ---------------- 初期描画 ---------------- */
    setBasics();
    summaryEl.value = profile.summary || "";
    salaryEl.value = profile.desired.salaryMin || "";
    workStyleEl.value = profile.desired.workStyle || "";
    timingEl.value = profile.desired.timing || "";
    notesEl.value = profile.desired.notes || "";
    renderWork();
    renderEdu();
    bindRemove(workList);
    bindRemove(eduList);
    renderPillcheck(jobTypesBox, MG.taxonomy.jobTypes, profile.desired.jobTypes);
    renderPillcheck(industriesBox, MG.taxonomy.industries, profile.desired.industries);
    renderPillcheck(locationsBox, MG.taxonomy.regions, profile.desired.locations);
    renderChipsBox(skillsBox, skills);
    renderChipsBox(certsBox, certs);
    bindChips(skillsBox, skills);
    bindChips(certsBox, certs);
    renderNoms();
    updateProgress();

    // 指名モーダルから来た場合の案内
    if (safeNext) {
      saveStatus.textContent = "お名前・メールを入力して保存すると、指名に戻れます。";
    }

    /* ---------------- ハッシュ位置へスクロール ---------------- */
    if (window.location.hash) {
      try {
        var target = document.querySelector(window.location.hash);
        if (target) {
          setTimeout(function () {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 80);
        }
      } catch (err) {
        /* 不正なセレクタは無視 */
      }
    }
  });
})();
