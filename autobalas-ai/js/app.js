/*
 * AutoBalas AI — Logik Aplikasi (Renderer)
 * Urus state, simulasi peti masuk live, paparan analisis AI & tetapan.
 */
(function () {
  'use strict';

  var AI = window.AutoReplyAI;
  var Demo = window.DemoData;

  var STORE_KEY = 'autobalas-ai-state-v1';

  var DEFAULT_SETTINGS = {
    autoReply: true,
    threshold: 0.8,
    tone: 'formal',
    company: 'Kedai TechMY',
    signature: 'Ahmad Faiz — Pasukan Khidmat Pelanggan',
    hours: 'Isnin–Jumaat, 9:00 pagi – 5:00 petang',
    alwaysReviewKeywords: 'refund, guaman, saman, kata laluan',
    intervalMs: 10000
  };

  var state = {
    emails: [],
    log: [],
    stats: { auto: 0, review: 0, spam: 0, manual: 0, confSum: 0, processed: 0 },
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    pool: null,
    selectedId: null,
    folder: 'inbox'
  };

  // ------------------------------------------------------------------
  // Simpanan (localStorage)
  // ------------------------------------------------------------------

  function save() {
    try {
      var copy = {
        emails: state.emails,
        log: state.log.slice(0, 300),
        stats: state.stats,
        settings: state.settings,
        selectedId: state.selectedId,
        folder: state.folder
      };
      localStorage.setItem(STORE_KEY, JSON.stringify(copy));
    } catch (e) { /* abaikan */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.emails)) return false;
      state.emails = data.emails;
      state.log = data.log || [];
      state.stats = data.stats || state.stats;
      state.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), data.settings || {});
      state.selectedId = data.selectedId || null;
      state.folder = data.folder || 'inbox';
      return true;
    } catch (e) {
      return false;
    }
  }

  // ------------------------------------------------------------------
  // Utiliti
  // ------------------------------------------------------------------

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function avatarColor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return 'hsl(' + h + ', 48%, 44%)';
  }

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  function timeAgo(ts) {
    var diff = Date.now() - ts;
    var m = Math.floor(diff / 60000);
    if (m < 1) return 'baru sekarang';
    if (m < 60) return m + ' minit lalu';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' jam lalu';
    var d = new Date(ts);
    return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' }) + ', ' +
      d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
  }

  function timeFull(ts) {
    return new Date(ts).toLocaleString('ms-MY', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function sentimentLabel(s) {
    return { positive: 'Positif', negative: 'Negatif', neutral: 'Neutral' }[s] || s;
  }

  function urgencyLabel(u) {
    return { high: 'TINGGI', medium: 'Sederhana', low: 'Rendah' }[u] || u;
  }

  function langLabel(l) {
    return l === 'en' ? 'English' : 'Bahasa Melayu';
  }

  var STATUS_CHIP = {
    new: '<span class="chip st-new">📩 BAHARU</span>',
    analyzing: '<span class="chip st-new">🧠 MENGANALISIS…</span>',
    auto_sent: '<span class="chip st-auto">✅ DIBALAS AUTO</span>',
    sent_manual: '<span class="chip st-auto">👤 DIHANTAR MANUAL</span>',
    review: '<span class="chip st-review">⚠️ PERLU SEMAKAN</span>',
    spam: '<span class="chip st-spam">🚫 SPAM</span>',
    archived: '<span class="chip">🗄️ DIARKIB</span>'
  };

  var FOLDER_TITLES = {
    inbox: 'Peti Masuk',
    review: 'Perlu Semakan',
    sent: 'Dihantar Auto',
    spam: 'Spam / Arkib',
    log: 'Log Aktiviti'
  };

  // ------------------------------------------------------------------
  // Toast
  // ------------------------------------------------------------------

  function toast(type, title, msg) {
    var box = $('#toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = '<b>' + esc(title) + '</b>' + esc(msg);
    box.appendChild(el);
    setTimeout(function () { el.classList.add('fade'); }, 4200);
    setTimeout(function () { el.remove(); }, 4800);
    while (box.children.length > 4) box.firstChild.remove();
  }

  // ------------------------------------------------------------------
  // Log
  // ------------------------------------------------------------------

  function addLog(type, subject, detail, ts) {
    state.log.unshift({ ts: ts || Date.now(), type: type, subject: subject, detail: detail });
    if (state.log.length > 300) state.log.length = 300;
  }

  // ------------------------------------------------------------------
  // Pipeline pemprosesan AI
  // ------------------------------------------------------------------

  function processEmail(email, opts) {
    var decision = AI.decide(email, state.settings);
    email.analysis = decision.analysis;
    email.decision = { action: decision.action, reason: decision.reason };
    email.draft = decision.reply;

    var a = decision.analysis;
    state.stats.processed++;
    state.stats.confSum += a.confidence;

    if (decision.action === 'auto_send') {
      email.status = 'auto_sent';
      email.sentAt = Date.now();
      email.read = true;
      state.stats.auto++;
      addLog('auto', email.subject, 'Auto-hantar · ' + decision.reason);
      if (!opts || !opts.silent) {
        toast('auto', '✅ Dibalas secara auto (' + Math.round(a.confidence * 100) + '%)',
          email.from.name + ' — ' + email.subject);
      }
    } else if (decision.action === 'spam') {
      email.status = 'spam';
      state.stats.spam++;
      addLog('spam', email.subject, decision.reason);
      if (!opts || !opts.silent) {
        toast('spam', '🚫 Spam disekat', email.subject);
      }
    } else {
      email.status = 'review';
      state.stats.review++;
      addLog('review', email.subject, decision.reason);
      if (!opts || !opts.silent) {
        toast('review', '⚠️ Perlu semakan anda', email.subject + ' — ' + decision.reason);
      }
    }
    save();
  }

  function manualSend(email, editedBody) {
    email.draft = { subject: email.draft.subject, body: editedBody };
    email.status = 'sent_manual';
    email.sentAt = Date.now();
    email.read = true;
    state.stats.manual++;
    addLog('send', email.subject, 'Dihantar manual selepas semakan manusia');
    save();
    toast('auto', '📤 Balasan dihantar!', 'Kepada: ' + email.from.name);
  }

  // ------------------------------------------------------------------
  // Emel masuk (simulasi live)
  // ------------------------------------------------------------------

  function receiveNew(silentIntro) {
    if (!state.pool) state.pool = Demo.createPoolFeeder();
    var email = state.pool();
    state.emails.unshift(email);
    if (!silentIntro) toast('info', '📩 Emel baharu diterima', email.from.name + ' — ' + email.subject);
    email.status = 'analyzing';
    render();
    setTimeout(function () {
      processEmail(email);
      render();
    }, 1500);
  }

  var liveTimer = null;

  function restartTimer() {
    if (liveTimer) clearInterval(liveTimer);
    liveTimer = null;
    if (state.settings.autoReply && state.settings.intervalMs > 0) {
      liveTimer = setInterval(function () { receiveNew(true); }, state.settings.intervalMs);
    }
    updateAiCard();
  }

  // ------------------------------------------------------------------
  // Render: senarai
  // ------------------------------------------------------------------

  function folderEmails(folder) {
    return state.emails.filter(function (e) {
      switch (folder) {
        case 'inbox': return ['new', 'analyzing', 'auto_sent', 'sent_manual', 'review'].indexOf(e.status) !== -1;
        case 'review': return e.status === 'review';
        case 'sent': return e.status === 'auto_sent' || e.status === 'sent_manual';
        case 'spam': return e.status === 'spam' || e.status === 'archived';
        default: return false;
      }
    });
  }

  function snippet(body) {
    return String(body || '').replace(/\s+/g, ' ').trim().slice(0, 90);
  }

  function renderList() {
    var pane = $('#list-pane');
    var emails = folderEmails(state.folder);

    if (state.folder === 'log') {
      pane.innerHTML = '<div class="log-pane">' + renderLogTable() + '</div>';
      return;
    }

    if (emails.length === 0) {
      pane.innerHTML =
        '<div class="empty-state" style="height:60vh">' +
        '<div class="empty-ico">📭</div><h3>Tiada emel di sini</h3>' +
        '<p>Klik "Terima Emel Sekarang" untuk simulasi emel masuk.</p></div>';
      return;
    }

    pane.innerHTML = emails.map(function (e) {
      var sel = e.id === state.selectedId ? ' selected' : '';
      var unread = !e.read ? ' unread' : '';
      var chips = [];
      if (e.status === 'analyzing') {
        chips.push('<span class="shimmer"></span>');
      } else {
        if (e.analysis) {
          chips.push('<span class="chip intent">' + esc(AI.intentLabel(e.analysis.intent)) + '</span>');
          if (e.analysis.sentiment !== 'neutral') {
            chips.push('<span class="chip sent-' + (e.analysis.sentiment === 'negative' ? 'neg' : 'pos') + '">' +
              sentimentLabel(e.analysis.sentiment) + '</span>');
          }
          chips.push('<span class="chip conf">' + Math.round(e.analysis.confidence * 100) + '%</span>');
        }
        chips.push(STATUS_CHIP[e.status] || '');
      }
      return (
        '<div class="email-card' + sel + unread + '" data-id="' + e.id + '">' +
        '<div class="ec-top">' +
        '<div class="avatar" style="background:' + avatarColor(e.from.name) + '">' + esc(initials(e.from.name)) + '</div>' +
        '<span class="ec-sender">' + esc(e.from.name) + '</span>' +
        '<span class="ec-time">' + timeAgo(e.receivedAt) + '</span>' +
        '</div>' +
        '<div class="ec-subject">' + esc(e.subject) + '</div>' +
        '<div class="ec-snippet">' + esc(snippet(e.body)) + '</div>' +
        '<div class="ec-chips">' + chips.join('') + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderLogTable() {
    if (state.log.length === 0) {
      return '<div class="empty-state"><div class="empty-ico">📋</div><h3>Log masih kosong</h3><p>Aktiviti AI akan direkodkan di sini.</p></div>';
    }
    var rows = state.log.map(function (l) {
      return '<tr>' +
        '<td style="white-space:nowrap;color:var(--text-dim)">' + timeAgo(l.ts) + '</td>' +
        '<td><span class="log-type ' + l.type + '">' + l.type.toUpperCase() + '</span></td>' +
        '<td><b>' + esc(l.subject) + '</b><br><span style="color:var(--text-dim)">' + esc(l.detail) + '</span></td>' +
        '</tr>';
    }).join('');
    return '<table class="log-table"><thead><tr><th>Masa</th><th>Jenis</th><th>Perincian</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  // ------------------------------------------------------------------
  // Render: pembaca
  // ------------------------------------------------------------------

  function renderReader() {
    var pane = $('#reader-pane');
    var email = state.emails.filter(function (e) { return e.id === state.selectedId; })[0];
    var reader = $('#reader');
    var empty = $('#empty-state');

    if (!email || state.folder === 'log') {
      reader.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';
    reader.style.display = 'block';

    var html = '';

    // Kepala emel
    html +=
      '<div class="r-head">' +
      '<div class="avatar" style="background:' + avatarColor(email.from.name) + '">' + esc(initials(email.from.name)) + '</div>' +
      '<div class="r-meta">' +
      '<h3>' + esc(email.subject) + '</h3>' +
      '<div class="r-from">Daripada: <b>' + esc(email.from.name) + '</b> &lt;' + esc(email.from.email) + '&gt;</div>' +
      '<div class="r-to">Kepada: saya@kedaitech.my</div>' +
      '</div>' +
      '<div class="r-date">' + timeFull(email.receivedAt) + '</div>' +
      '</div>' +
      '<div class="r-body">' + esc(email.body) + '</div>';

    // Status menganalisis
    if (email.status === 'analyzing') {
      html += '<div class="ai-panel" style="text-align:center;padding:28px">' +
        '<div class="shimmer" style="width:220px;height:16px;margin:0 auto 12px"></div>' +
        '<p style="color:var(--text-dim);font-size:13px">🧠 AutoBalas AI sedang menganalisis emel ini…</p></div>';
      reader.innerHTML = html;
      return;
    }

    // Panel analisis AI
    if (email.analysis) {
      var a = email.analysis;
      var pct = Math.round(a.confidence * 100);
      var action = email.decision ? email.decision.action : '';
      var vClass = action === 'auto_send' ? 'auto' : (action === 'spam' ? 'spam' : 'review');
      var vIcon = action === 'auto_send' ? '✅' : (action === 'spam' ? '🚫' : '⚠️');
      var vText = action === 'auto_send' ? 'AI TELAH MEMBALAS SECARA OTOMATIK'
        : (action === 'spam' ? 'DIKECAM SEBAGAI SPAM — TIADA BALASAN DIHANTAR'
          : 'PERLU SEMAKAN MANUSIA');
      html +=
        '<div class="ai-panel">' +
        '<div class="ai-panel-head">🧠 Analisis AutoBalas AI</div>' +
        '<div class="ai-grid">' +
        cell('Bahasa', langLabel(a.language), '') +
        cell('Niat Dikesan', a.intentLabel, 'intent-v') +
        cell('Sentimen', sentimentLabel(a.sentiment), a.sentiment === 'positive' ? 'pos' : (a.sentiment === 'negative' ? 'neg' : 'neu')) +
        cell('Urgensi', urgencyLabel(a.urgency), a.urgency === 'high' ? 'urg-high' : (a.urgency === 'medium' ? 'urg-med' : 'urg-low')) +
        '</div>' +
        '<div class="conf-bar-wrap">' +
        '<div class="conf-bar-head"><span>Keyakinan Klasifikasi</span><span><b>' + pct + '%</b> (ambang ' + Math.round(state.settings.threshold * 100) + '%)</span></div>' +
        '<div class="conf-bar"><div class="conf-fill" style="width:' + pct + '%"></div></div>' +
        '</div>' +
        (a.keywords.length ? '<div class="kw-row"><span class="k-label">Kata kunci:</span>' +
          a.keywords.map(function (k) { return '<span class="chip">' + esc(k) + '</span>'; }).join('') + '</div>' : '') +
        '<div class="verdict ' + vClass + '">' + vIcon + ' <div><div>' + vText + '</div>' +
        '<div class="v-reason">' + esc(email.decision ? email.decision.reason : '') + '</div></div></div>' +
        '</div>';
    }

    // Bahagian draf / balasan
    if (email.status === 'review') {
      html +=
        '<div class="draft-section">' +
        '<div class="draft-head">✍️ Draf AI — semak & edit sebelum hantar' +
        '<span class="d-stamp" style="background:rgba(227,164,38,.15);color:var(--amber)">MENUNGGU SEMAKAN</span></div>' +
        '<div class="draft-meta" style="margin:0 0 8px">Subjek: <b>' + esc(email.draft ? email.draft.subject : 'Re: ' + email.subject) + '</b></div>' +
        '<textarea class="draft-box" id="draft-box">' + esc(email.draft ? email.draft.body : '') + '</textarea>' +
        '<div class="draft-actions">' +
        '<button class="primary-btn" id="btn-send">📤 Hantar Balasan</button>' +
        '<button class="ghost-btn" id="btn-archive">🗄️ Arkib Tanpa Balas</button>' +
        '<button class="ghost-btn danger" id="btn-mark-spam">🚫 Tanda Spam</button>' +
        '</div></div>';
    } else if (email.status === 'auto_sent' || email.status === 'sent_manual') {
      var stamp = email.status === 'auto_sent' ? 'DIHANTAR OLEH AI' : 'DIHANTAR MANUAL OLEH ANDA';
      html +=
        '<div class="draft-section">' +
        '<div class="draft-head">📤 Balasan yang telah dihantar' +
        '<span class="d-stamp">' + stamp + '</span></div>' +
        '<div class="draft-meta" style="margin:0 0 8px">Subjek: <b>' + esc(email.draft ? email.draft.subject : '') + '</b>' +
        (email.sentAt ? ' · Dihantar ' + timeAgo(email.sentAt) : '') + '</div>' +
        '<div class="r-body" style="margin-top:0">' + esc(email.draft ? email.draft.body : '') + '</div>' +
        '</div>';
    } else if (email.status === 'spam') {
      html +=
        '<div class="draft-section">' +
        '<div class="verdict spam">🚫 <div><div>EMEL INI DIKECAM SEBAGAI SPAM</div>' +
        '<div class="v-reason">' + esc(email.decision ? email.decision.reason : '') + ' — tiada balasan dijana untuk melindungi anda.</div></div></div>' +
        '<div class="draft-actions">' +
        '<button class="ghost-btn" id="btn-archive">🗄️ Arkib</button>' +
        '<button class="ghost-btn danger" id="btn-review-anyway">⚠️ Semak Manual Juga</button>' +
        '</div></div>';
    } else if (email.status === 'archived') {
      html += '<div class="draft-section"><div class="verdict review">🗄️ <div><div>EMEL INI DIARKIB</div>' +
        '<div class="v-reason">Tiada tindakan lanjut.</div></div></div></div>';
    }

    reader.innerHTML = html;
    bindReaderActions(email);
  }

  function cell(k, v, cls) {
    return '<div class="ai-cell"><div class="k">' + k + '</div><div class="v ' + (cls || '') + '">' + esc(v) + '</div></div>';
  }

  function bindReaderActions(email) {
    var btnSend = $('#btn-send');
    if (btnSend) {
      btnSend.addEventListener('click', function () {
        var body = $('#draft-box').value.trim();
        if (!body) { toast('review', 'Draf kosong', 'Sila tulis sesuatu sebelum menghantar.'); return; }
        manualSend(email, body);
        render();
      });
    }
    var btnArch = $('#btn-archive');
    if (btnArch) {
      btnArch.addEventListener('click', function () {
        email.status = 'archived';
        addLog('info', email.subject, 'Diarkib tanpa balasan (oleh pengguna)');
        save();
        toast('info', '🗄️ Diarkibkan', email.subject);
        render();
      });
    }
    var btnSpam = $('#btn-mark-spam');
    if (btnSpam) {
      btnSpam.addEventListener('click', function () {
        email.status = 'spam';
        addLog('spam', email.subject, 'Ditanda spam oleh pengguna');
        save();
        toast('spam', '🚫 Ditanda spam', email.subject);
        render();
      });
    }
    var btnRev = $('#btn-review-anyway');
    if (btnRev) {
      btnRev.addEventListener('click', function () {
        email.status = 'review';
        addLog('review', email.subject, 'Pengguna mahu menyemak spam ini');
        save();
        render();
      });
    }
  }

  // ------------------------------------------------------------------
  // Render: stats, badges, kad AI
  // ------------------------------------------------------------------

  function updateBadges() {
    setBadge('#badge-inbox', folderEmails('inbox').length);
    setBadge('#badge-review', folderEmails('review').length, true);
    setBadge('#badge-sent', folderEmails('sent').length);
    setBadge('#badge-spam', folderEmails('spam').length);
  }

  function setBadge(sel, n, warn) {
    var el = $(sel);
    el.textContent = n > 0 ? String(n) : '';
    el.className = 'badge' + (warn && n > 0 ? ' warn' : '') + (n === 0 ? ' zero' : '');
  }

  function updateStats() {
    $('#st-auto').textContent = state.stats.auto + state.stats.manual;
    $('#st-review').textContent = state.stats.review;
    $('#st-spam').textContent = state.stats.spam;
    var avg = state.stats.processed > 0
      ? Math.round((state.stats.confSum / state.stats.processed) * 100) + '%'
      : '–';
    $('#st-conf').textContent = avg;
  }

  function updateAiCard() {
    var on = state.settings.autoReply;
    $('#pulse-dot').className = 'pulse-dot' + (on ? '' : ' off');
    $('#ai-status-text').textContent = on ? 'AI Sedang Memantau' : 'AI Dihentikan';
    $('#ai-card-sub').innerHTML = on
      ? (state.settings.intervalMs > 0
        ? 'Emel baharu diproses setiap <b>' + Math.round(state.settings.intervalMs / 1000) + 's</b>'
        : 'Mod manual — klik butang terima emel')
      : 'Hidupkan suis untuk aktifkan balasan auto';
    $('#auto-toggle').checked = on;
  }

  function render() {
    $('#folder-title').textContent = FOLDER_TITLES[state.folder] || 'Peti Masuk';
    $$('.nav-item').forEach(function (n) {
      n.classList.toggle('active', n.getAttribute('data-folder') === state.folder);
    });
    renderList();
    renderReader();
    updateBadges();
    updateStats();
    updateAiCard();
  }

  // ------------------------------------------------------------------
  // Tetapan
  // ------------------------------------------------------------------

  function openSettings() {
    var s = state.settings;
    $('#set-company').value = s.company;
    $('#set-signature').value = s.signature;
    $('#set-tone').value = s.tone;
    $('#set-hours').value = s.hours;
    $('#set-threshold').value = Math.round(s.threshold * 100);
    $('#threshold-val').textContent = Math.round(s.threshold * 100) + '%';
    $('#set-keywords').value = s.alwaysReviewKeywords;
    $('#set-interval').value = String(s.intervalMs);
    $('#settings-modal').style.display = 'flex';
  }

  function closeSettings() {
    $('#settings-modal').style.display = 'none';
  }

  function saveSettings() {
    var s = state.settings;
    s.company = $('#set-company').value.trim() || DEFAULT_SETTINGS.company;
    s.signature = $('#set-signature').value.trim() || DEFAULT_SETTINGS.signature;
    s.tone = $('#set-tone').value;
    s.hours = $('#set-hours').value.trim();
    s.threshold = parseInt($('#set-threshold').value, 10) / 100;
    s.alwaysReviewKeywords = $('#set-keywords').value.trim();
    s.intervalMs = parseInt($('#set-interval').value, 10);
    save();
    closeSettings();
    restartTimer();
    render();
    toast('info', '💾 Tetapan disimpan', 'Ambang keyakinan: ' + Math.round(s.threshold * 100) + '% · Gaya: ' + s.tone);
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------

  function init() {
    var restored = load();

    if (!restored) {
      // Seed pertama: proses 8 emel demo seolah-olah sudah lama berjalan
      state.pool = Demo.createPoolFeeder();
      state.emails = Demo.seedInitial();
      // Proses tertua dahulu supaya susunan log masuk akal
      state.emails.slice().sort(function (a, b) { return a.receivedAt - b.receivedAt; })
        .forEach(function (e) {
          processEmail(e, { silent: true });
        });
      addLog('info', 'AutoBalas AI dimulakan', 'Mod demo diaktifkan — enjin AI memantau peti masuk anda');
      // Pilih emel review pertama untuk paparan awal menarik
      var firstReview = state.emails.filter(function (e) { return e.status === 'review'; })[0];
      if (firstReview) { firstReview.read = false; state.selectedId = firstReview.id; }
      save();
    } else {
      state.pool = Demo.createPoolFeeder();
    }

    bindEvents();
    restartTimer();
    render();

    // Salam awal
    setTimeout(function () {
      toast('info', '🤖 AutoBalas AI aktif!',
        state.stats.review + ' emel menunggu semakan · ' + state.stats.auto + ' telah dibalas auto.');
    }, 600);
  }

  function bindEvents() {
    // Navigasi folder
    $$('.nav-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.folder = btn.getAttribute('data-folder');
        save();
        render();
      });
    });

    // Klik emel dalam senarai (delegation)
    $('#list-pane').addEventListener('click', function (ev) {
      var card = ev.target.closest('.email-card');
      if (!card) return;
      var email = state.emails.filter(function (e) { return e.id === card.getAttribute('data-id'); })[0];
      if (!email) return;
      email.read = true;
      state.selectedId = email.id;
      save();
      render();
    });

    // Toggle auto
    $('#auto-toggle').addEventListener('change', function (ev) {
      state.settings.autoReply = ev.target.checked;
      addLog('info', 'Balasan auto ' + (state.settings.autoReply ? 'DIHIDUPKAN' : 'DIMATIKAN'),
        state.settings.autoReply ? 'AI kembali memantau peti masuk' : 'Tiada emel akan diproses sehingga dihidupkan semula');
      save();
      restartTimer();
      toast('info',
        state.settings.autoReply ? '▶️ Balasan auto dihidupkan' : '⏸️ Balasan auto dimatikan',
        state.settings.autoReply ? 'AI akan terus memantau peti masuk anda.' : 'Emel baharu tidak akan diproses.');
    });

    // Terima emel sekarang
    $('#btn-receive').addEventListener('click', function () { receiveNew(false); });

    // Reset demo
    $('#btn-reset').addEventListener('click', function () {
      try { localStorage.removeItem(STORE_KEY); } catch (e) { }
      state.emails = [];
      state.log = [];
      state.stats = { auto: 0, review: 0, spam: 0, manual: 0, confSum: 0, processed: 0 };
      state.selectedId = null;
      state.folder = 'inbox';
      state.pool = Demo.createPoolFeeder();
      state.emails = Demo.seedInitial();
      state.emails.slice().sort(function (a, b) { return a.receivedAt - b.receivedAt; })
        .forEach(function (e) { processEmail(e, { silent: true }); });
      addLog('info', 'Demo diset semula', 'Semua data demo dikosongkan dan dimulakan semula');
      save();
      render();
      toast('info', '↺ Demo diset semula', 'Peti masuk dikembalikan kepada keadaan asal.');
    });

    // Tetapan
    $('#btn-settings').addEventListener('click', openSettings);
    $('#btn-close-settings').addEventListener('click', closeSettings);
    $('#btn-cancel-settings').addEventListener('click', closeSettings);
    $('#btn-save-settings').addEventListener('click', saveSettings);
    $('#settings-modal').addEventListener('click', function (ev) {
      if (ev.target === this) closeSettings();
    });
    $('#set-threshold').addEventListener('input', function () {
      $('#threshold-val').textContent = this.value + '%';
    });

    // Klik emel yang sedang dianalisis — kemas kini masa "baru sekarang"
    setInterval(function () {
      if (state.folder !== 'log') {
        // refresh masa relatif dalam senarai secara senyap
        var times = $$('.ec-time');
        var emails = folderEmails(state.folder);
        times.forEach(function (el, i) {
          if (emails[i]) el.textContent = timeAgo(emails[i].receivedAt);
        });
      }
    }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
