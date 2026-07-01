/* =========================================================
   MarkGate — shared form handler (Formspree)
   Handles any <form data-formspree action="https://formspree.io/f/XXXX">.
   Keeps the site's styled forms; just posts them to Formspree.
   Loaded on index.html (#contactForm) and join.html (advisor/waitlist).
   ========================================================= */
(function () {
  "use strict";

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  document.querySelectorAll("form[data-formspree]").forEach(function (form) {
    var status = form.querySelector(".form-status");
    var btn = form.querySelector('button[type="submit"]');

    function setStatus(msg, cls) {
      if (!status) return;
      status.className = "form-status" + (cls ? " " + cls : "");
      status.textContent = msg;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setStatus("", "");

      var email = form.querySelector('input[type="email"]');
      var agree = form.querySelector('input[type="checkbox"][required]');

      if (!form.checkValidity()) {
        setStatus("未入力の必須項目があります。ご確認ください。", "err");
        form.reportValidity();
        return;
      }
      if (email && !EMAIL_RE.test(email.value)) {
        setStatus("メールアドレスの形式をご確認ください。", "err");
        return;
      }
      if (agree && !agree.checked) {
        setStatus("同意事項へのチェックが必要です。", "err");
        return;
      }

      var endpoint = form.getAttribute("action") || "";
      // Guard: not yet connected to a real Formspree form.
      if (!/formspree\.io\/f\//.test(endpoint) || endpoint.indexOf("YOUR_FORM_ID") !== -1) {
        setStatus("送信先が未設定です。docs/lead-capture-setup.md の手順で Formspree のフォームIDを設定してください。", "err");
        return;
      }

      if (btn) btn.disabled = true;
      setStatus("送信中…", "");

      fetch(endpoint, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      })
        .then(function (res) {
          if (res.ok) {
            setStatus(
              form.getAttribute("data-success") ||
                "送信ありがとうございます。担当者より折り返しご連絡いたします。",
              "ok"
            );
            form.reset();
          } else {
            return res.json().then(
              function (d) {
                var msg =
                  d && d.errors
                    ? d.errors
                        .map(function (x) {
                          return x.message;
                        })
                        .join(" / ")
                    : "送信に失敗しました。時間をおいて再度お試しください。";
                setStatus(msg, "err");
              },
              function () {
                setStatus("送信に失敗しました。時間をおいて再度お試しください。", "err");
              }
            );
          }
        })
        .catch(function () {
          setStatus("通信エラーが発生しました。ネットワークをご確認のうえ再度お試しください。", "err");
        })
        .then(function () {
          if (btn) btn.disabled = false;
        });
    });
  });
})();
