(function () {
  "use strict";

  var cfg = window.FC_BOOKING_CONFIG || {};
  var API = (cfg.apiBase || "").replace(/\/$/, "");

  var state = {
    eventType: "consult",
    staffId: "any",
    selectedDay: null,
    selectedSlot: null,
    slots: [],
    step: 1,
    source: document.title || location.hostname,
  };

  var overlay = null;

  function tzFormat(date, opts) {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      ...opts,
    }).format(date);
  }

  function buildModal() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "fc-booking-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML =
      '<div class="fc-booking-modal">' +
      '<div class="fc-booking-header">' +
      '<h2 id="fc-booking-title">予約する</h2>' +
      '<button type="button" class="fc-booking-close" aria-label="閉じる">&times;</button>' +
      "</div>" +
      '<div class="fc-booking-body" id="fc-booking-body"></div>' +
      '<div class="fc-booking-actions" id="fc-booking-actions"></div>' +
      "</div>";
    document.body.appendChild(overlay);

    overlay.querySelector(".fc-booking-close").addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
    });
    return overlay;
  }

  function close() {
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function open(options) {
    options = options || {};
    state.eventType = options.eventType || "consult";
    state.staffId = options.staffId || "any";
    state.selectedDay = null;
    state.selectedSlot = null;
    state.slots = [];
    state.step = 1;
    buildModal();
    document.body.style.overflow = "hidden";
    overlay.classList.add("is-open");
    render();
    if (state.step === 1) loadSlots();
  }

  function setTitle() {
    var ev = (cfg.events || {})[state.eventType] || { label: "予約" };
    document.getElementById("fc-booking-title").textContent = ev.label + "の予約";
  }

  function renderActions() {
    var actions = document.getElementById("fc-booking-actions");
    if (state.step === 4) {
      actions.innerHTML =
        '<button type="button" class="fc-booking-btn fc-booking-btn--ghost" data-action="back">戻る</button>' +
        '<button type="button" class="fc-booking-btn fc-booking-btn--primary" data-action="submit">予約を確定する</button>';
    } else if (state.step === 5) {
      actions.innerHTML =
        '<button type="button" class="fc-booking-btn fc-booking-btn--primary" data-action="close">閉じる</button>';
    } else if (state.step === 2 && state.selectedSlot) {
      actions.innerHTML =
        '<button type="button" class="fc-booking-btn fc-booking-btn--ghost" data-action="back">戻る</button>' +
        '<button type="button" class="fc-booking-btn fc-booking-btn--primary" data-action="next">次へ</button>';
    } else {
      actions.innerHTML = "";
    }
    actions.querySelectorAll("[data-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var action = btn.getAttribute("data-action");
        if (action === "back") {
          state.step = Math.max(1, state.step - 1);
          render();
        } else if (action === "next") {
          state.step = 4;
          render();
        } else if (action === "submit") {
          submitBooking();
        } else if (action === "close") {
          close();
        }
      });
    });
  }

  function fallbackHtml() {
    var b = cfg.brand || {};
    return (
      '<div class="fc-booking-fallback">' +
      "お電話: <a href=\"tel:" +
      (b.phone || "").replace(/-/g, "") +
      "\">" +
      (b.phoneDisplay || b.phone || "") +
      "</a><br>" +
      "メール: <a href=\"mailto:" +
      (b.email || "") +
      "\">" +
      (b.email || "") +
      "</a>" +
      "</div>"
    );
  }

  function renderStaffChips() {
    var staffList = cfg.staff || [];
    if (staffList.length <= 1) {
      if (staffList.length === 1) state.staffId = staffList[0].id;
      return "";
    }
    var staff = [{ id: "any", name: "どちらでもOK" }].concat(staffList);
    return (
      '<div class="fc-booking-step-label">担当者</div>' +
      '<div class="fc-booking-chips" id="fc-staff-chips">' +
      staff
        .map(function (s) {
          var sel = state.staffId === s.id ? " is-selected" : "";
          return (
            '<button type="button" class="fc-booking-chip' +
            sel +
            '" data-staff="' +
            s.id +
            '">' +
            s.name +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function groupSlotsByDay(slots) {
    var map = {};
    slots.forEach(function (slot) {
      var day = tzFormat(new Date(slot.start), {
        month: "numeric",
        day: "numeric",
        weekday: "short",
      });
      var key = slot.start.slice(0, 10);
      if (!map[key]) map[key] = { label: day, key: key, slots: [] };
      map[key].slots.push(slot);
    });
    return Object.values(map).sort(function (a, b) {
      return a.key.localeCompare(b.key);
    });
  }

  function render() {
    setTitle();
    var body = document.getElementById("fc-booking-body");
    var ev = (cfg.events || {})[state.eventType] || {};

    if (state.step === 1) {
      body.innerHTML =
        '<div id="fc-staff-block">' +
        renderStaffChips() +
        "</div>" +
        '<div class="fc-booking-step-label">' +
        ev.label +
        "（" +
        (ev.durationMinutes || 30) +
        "分）の空き時間</div>" +
        '<div id="fc-booking-loading" class="fc-booking-msg">空き時間を読み込み中…</div>' +
        '<div id="fc-booking-calendar" hidden></div>' +
        fallbackHtml();
      bindStaffChips();
    } else if (state.step === 4) {
      var slot = state.selectedSlot;
      var when = slot
        ? tzFormat(new Date(slot.start), {
            month: "long",
            day: "numeric",
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      body.innerHTML =
        '<div class="fc-booking-step-label">予約内容の確認</div>' +
        "<p style=\"margin-bottom:16px;font-size:0.9rem;\"><strong>" +
        when +
        "</strong><br>" +
        ev.label +
        "</p>" +
        '<div class="fc-booking-field"><label>お名前 <span style="color:#c41e24">*</span></label><input name="name" required autocomplete="name"></div>' +
        '<div class="fc-booking-field"><label>メールアドレス <span style="color:#c41e24">*</span></label><input name="email" type="email" required autocomplete="email"></div>' +
        '<div class="fc-booking-field"><label>電話番号</label><input name="phone" type="tel" autocomplete="tel"></div>' +
        '<div class="fc-booking-field"><label>希望エリア</label><input name="area" placeholder="例：静岡県浜松市"></div>' +
        '<div class="fc-booking-field"><label>開業希望時期</label><select name="timing"><option value="">選択</option><option>3ヶ月以内</option><option>半年以内</option><option>1年以内</option><option>未定</option></select></div>' +
        '<div class="fc-booking-field"><label>ご相談内容</label><textarea name="message" placeholder="気になる点をご記入ください"></textarea></div>';
    } else if (state.step === 5) {
      body.innerHTML = state.successHtml || "";
    }

    renderActions();
  }

  function bindStaffChips() {
    document.querySelectorAll("#fc-staff-chips .fc-booking-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        state.staffId = chip.getAttribute("data-staff");
        state.selectedDay = null;
        state.selectedSlot = null;
        render();
        loadSlots();
      });
    });
  }

  function renderCalendar() {
    var loading = document.getElementById("fc-booking-loading");
    var cal = document.getElementById("fc-booking-calendar");
    if (!cal) return;

    if (!state.slots.length) {
      loading.textContent = "現在、予約可能な空き時間がありません。お電話またはメールでお問い合わせください。";
      loading.classList.add("fc-booking-msg--error");
      return;
    }

    loading.hidden = true;
    cal.hidden = false;

    var days = groupSlotsByDay(state.slots);
    if (!state.selectedDay && days.length) state.selectedDay = days[0].key;

    var dayHtml =
      '<div class="fc-booking-days">' +
      days
        .map(function (d) {
          var sel = state.selectedDay === d.key ? " is-selected" : "";
          var parts = d.label.split(/[()（）]/);
          return (
            '<button type="button" class="fc-booking-day' +
            sel +
            '" data-day="' +
            d.key +
            '"><span class="dow">' +
            d.label +
            '</span><span class="date">' +
            d.key.slice(5).replace("-", "/") +
            "</span></button>"
          );
        })
        .join("") +
      "</div>";

    var daySlots = days.find(function (d) {
      return d.key === state.selectedDay;
    });
    var slotHtml =
      '<div class="fc-booking-slots">' +
      (daySlots
        ? daySlots.slots
            .map(function (s) {
              var t = tzFormat(new Date(s.start), {
                hour: "2-digit",
                minute: "2-digit",
              });
              var sel =
                state.selectedSlot && state.selectedSlot.start === s.start
                  ? " is-selected"
                  : "";
              return (
                '<button type="button" class="fc-booking-slot' +
                sel +
                '" data-start="' +
                s.start +
                '">' +
                t +
                "</button>"
              );
            })
            .join("")
        : "") +
      "</div>";

    cal.innerHTML = dayHtml + slotHtml;

    cal.querySelectorAll(".fc-booking-day").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.selectedDay = btn.getAttribute("data-day");
        state.selectedSlot = null;
        renderCalendar();
      });
    });

    cal.querySelectorAll(".fc-booking-slot").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var start = btn.getAttribute("data-start");
        state.selectedSlot = state.slots.find(function (s) {
          return s.start === start;
        });
        state.step = 2;
        render();
      });
    });
  }

  function loadSlots() {
    if (!API) {
      document.getElementById("fc-booking-loading").textContent =
        "予約APIの URL が未設定です（config.js の apiBase）";
      return;
    }

    var url =
      API +
      "/.netlify/functions/availability?eventType=" +
      encodeURIComponent(state.eventType) +
      "&staffId=" +
      encodeURIComponent(state.staffId) +
      "&days=14";

    fetch(url)
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(result.data.error || "取得に失敗しました");
        }
        state.slots = result.data.slots || [];
        if (result.data.staff && result.data.staff.length) {
          cfg.staff = result.data.staff;
          var block = document.getElementById("fc-staff-block");
          if (block) {
            block.innerHTML = renderStaffChips();
            bindStaffChips();
          }
        }
        renderCalendar();
      })
      .catch(function (err) {
        var el = document.getElementById("fc-booking-loading");
        var msg = err.message || "空き時間の取得に失敗しました";
        if (msg === "Failed to fetch") {
          msg =
            "予約APIに接続できませんでした。しばらくしてから再度お試しください。";
        }
        if (el) {
          el.textContent = msg;
          el.classList.add("fc-booking-msg--error");
        }
      });
  }

  function submitBooking() {
    var body = document.getElementById("fc-booking-body");
    var get = function (name) {
      var el = body.querySelector("[name=\"" + name + "\"]");
      return el ? el.value.trim() : "";
    };
    var name = get("name");
    var email = get("email");
    if (!name || !email) {
      alert("お名前とメールアドレスは必須です");
      return;
    }
    if (!state.selectedSlot) {
      alert("時間を選択してください");
      return;
    }

    var btn = document.querySelector("[data-action=\"submit\"]");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "送信中…";
    }

    var staffId =
      state.staffId !== "any"
        ? state.staffId
        : (state.selectedSlot.staffIds && state.selectedSlot.staffIds[0]) || null;

    fetch(API + "/.netlify/functions/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: state.eventType,
        staffId: staffId,
        start: state.selectedSlot.start,
        name: name,
        email: email,
        phone: get("phone"),
        area: get("area"),
        timing: get("timing"),
        message: get("message"),
        source: state.source,
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data.error || "予約に失敗しました");
        var d = result.data;
        state.step = 5;
        state.successHtml =
          '<div class="fc-booking-success">' +
          "<h3>予約が完了しました</h3>" +
          "<p>担当: " +
          (d.staffName || "") +
          "</p>" +
          "<p>確認メールをお送りしました。</p>" +
          (d.meetLink
            ? '<p>オンライン面談 URL:<br><a href="' +
              d.meetLink +
              '" target="_blank" rel="noopener">' +
              d.meetLink +
              "</a></p>"
            : "") +
          "</div>";
        render();
      })
      .catch(function (err) {
        alert(err.message || "予約に失敗しました");
        if (btn) {
          btn.disabled = false;
          btn.textContent = "予約を確定する";
        }
      });
  }

  function detectEventType(el) {
    if (el.dataset.fcEvent) return el.dataset.fcEvent;
    var t = (el.textContent || "").replace(/\s+/g, "");
    if (t.indexOf("説明会") >= 0) return "briefing";
    return "consult";
  }

  function bindTriggers() {
    document.querySelectorAll(".fc-booking-open").forEach(function (el) {
      if (el.dataset.fcBound) return;
      el.dataset.fcBound = "1";
      el.addEventListener("click", function (e) {
        e.preventDefault();
        open({ eventType: detectEventType(el) });
      });
    });
  }

  window.FCBooking = { open: open, close: close };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindTriggers);
  } else {
    bindTriggers();
  }

  /** 動的に追加されたボタンにも対応 */
  new MutationObserver(bindTriggers).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
