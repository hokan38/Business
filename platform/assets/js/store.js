/* =========================================================
   MarkGate Platform — Data store (localStorage)
   求職者のプロフィール（マイページ）と指名（ nomination ）を
   ブラウザの localStorage に保存します。
   ※本番では認証付きAPI/DBに置き換える前提のクライアント実装です。
   ========================================================= */
(function () {
  "use strict";
  window.MG = window.MG || {};

  var KEY_PROFILE = "mg.profile.v1";
  var KEY_NOMINATIONS = "mg.nominations.v1";

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function read(key, fallback) {
    try {
      return safeParse(window.localStorage.getItem(key), fallback);
    } catch (e) {
      // localStorage が使えない環境（プライベートモード等）
      return fallback;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- デフォルトの求職者プロフィール ---------- */
  function defaultProfile() {
    return {
      basics: {
        name: "",
        kana: "",
        email: "",
        phone: "",
        birthYear: "",
        location: "",
        currentCompany: "",
        currentTitle: "",
      },
      summary: "", // 職務要約
      workHistory: [], // { company, title, period, description }
      education: [], // { school, degree, field, period }
      skills: [], // 文字列配列
      certifications: [], // 文字列配列
      desired: {
        jobTypes: [], // taxonomy.jobTypes
        industries: [], // taxonomy.industries
        salaryMin: "", // 希望年収（万円）
        locations: [], // taxonomy.regions
        workStyle: "", // 例: フルリモート可 / ハイブリッド希望 等
        timing: "", // 転職希望時期
        notes: "", // その他希望・こだわり
      },
      updatedAt: null,
    };
  }

  function newId(prefix) {
    // Date.now + カウンタで衝突回避（ランダム不使用でも十分にユニーク）
    if (!MG._idCounter) MG._idCounter = 0;
    MG._idCounter += 1;
    return (prefix || "id") + "_" + Date.now().toString(36) + "_" + MG._idCounter;
  }

  MG.store = {
    /* ----- プロフィール ----- */
    getProfile: function () {
      var p = read(KEY_PROFILE, null);
      if (!p) return defaultProfile();
      // 後方互換: 欠けているキーをデフォルトで補完
      var base = defaultProfile();
      return {
        basics: Object.assign({}, base.basics, p.basics || {}),
        summary: p.summary || "",
        workHistory: Array.isArray(p.workHistory) ? p.workHistory : [],
        education: Array.isArray(p.education) ? p.education : [],
        skills: Array.isArray(p.skills) ? p.skills : [],
        certifications: Array.isArray(p.certifications) ? p.certifications : [],
        desired: Object.assign({}, base.desired, p.desired || {}),
        updatedAt: p.updatedAt || null,
      };
    },

    saveProfile: function (profile) {
      var p = Object.assign(defaultProfile(), profile || {});
      p.updatedAt = new Date().toISOString();
      var ok = write(KEY_PROFILE, p);
      return ok ? p : null;
    },

    // プロフィールが「連絡に使える」最低限の入力（氏名＋メール）を満たすか
    isProfileContactable: function () {
      var b = this.getProfile().basics;
      return !!(b.name && b.email);
    },

    // 任意のプロフィールオブジェクトの充実度（0〜100）を算出（判定基準の唯一の定義）。
    completenessOf: function (p) {
      var b = (p && p.basics) || {};
      var d = (p && p.desired) || {};
      var checks = [
        !!b.name,
        !!b.email,
        !!b.location,
        !!b.currentTitle,
        !!(p && p.summary),
        !!(p && p.workHistory && p.workHistory.length),
        !!(p && p.education && p.education.length),
        !!(p && p.skills && p.skills.length),
        !!((d.jobTypes && d.jobTypes.length) || (d.industries && d.industries.length)),
        !!d.salaryMin,
      ];
      var done = checks.filter(Boolean).length;
      return Math.round((done / checks.length) * 100);
    },

    // 保存済みプロフィールの充実度。マイページ入力中は completenessOf(collect()) を使う。
    profileCompleteness: function () {
      return this.completenessOf(this.getProfile());
    },

    /* ----- 指名（ nomination ） ----- */
    getNominations: function () {
      var list = read(KEY_NOMINATIONS, []);
      return Array.isArray(list) ? list : [];
    },

    hasNominated: function (advisorId) {
      return this.getNominations().some(function (n) {
        return n.advisorId === advisorId && n.status !== "取消";
      });
    },

    getNomination: function (advisorId) {
      return this.getNominations().find(function (n) {
        return n.advisorId === advisorId && n.status !== "取消";
      }) || null;
    },

    // 指名を作成。成功時は作成した nomination オブジェクトを返す。
    addNomination: function (data) {
      var list = this.getNominations();
      var nom = {
        id: newId("nom"),
        advisorId: data.advisorId,
        advisorName: data.advisorName || "",
        advisorEmail: data.advisorEmail || "",
        message: data.message || "",
        seeker: data.seeker || {},
        status: "連絡済み", // 連絡済み → 返信待ち → …（デモでは固定）
        createdAt: new Date().toISOString(),
      };
      list.unshift(nom);
      var ok = write(KEY_NOMINATIONS, list);
      return ok ? nom : null;
    },

    cancelNomination: function (id) {
      var list = this.getNominations();
      var idx = list.findIndex(function (n) { return n.id === id; });
      if (idx === -1) return false;
      list.splice(idx, 1);
      return write(KEY_NOMINATIONS, list);
    },

    // アドバイザー側の受信箱（デモ）: advisorId ごとに指名をまとめる
    getInboxByAdvisor: function () {
      var map = {};
      this.getNominations().forEach(function (n) {
        if (!map[n.advisorId]) map[n.advisorId] = [];
        map[n.advisorId].push(n);
      });
      return map;
    },

    clearAll: function () {
      try {
        window.localStorage.removeItem(KEY_PROFILE);
        window.localStorage.removeItem(KEY_NOMINATIONS);
        return true;
      } catch (e) {
        return false;
      }
    },
  };
})();
