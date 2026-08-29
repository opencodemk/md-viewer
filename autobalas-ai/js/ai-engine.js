/*
 * AutoBalas AI — Enjin Analisis & Penjanaan Balasan
 * ---------------------------------------------------
 * Enjin "AI" bawaan (tanpa API luar) yang:
 *  1. Mengesan bahasa emel (BM / English)
 *  2. Mengklasifikasi niat (inquiry, support, complaint, order, billing,
 *     meeting, application, partnership, feedback, spam, other)
 *  3. Menganalisis sentimen & tahap urgensi
 *  4. Menjana draf balasan mengikut gaya bahasa (formal / santai)
 *  5. Memutuskan: auto-hantar / perlu semakan manusia / spam
 *
 * Modul ini tulen (tiada kebergantungan) — boleh jalan dalam pelayar
 * mahupun Node.js untuk pengujian.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AutoReplyAI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------------
  // Kamus kata kunci & frasa (berpemberat / weighted)
  // ------------------------------------------------------------------

  var MARKERS_MS = [' yang ', ' dan ', ' saya ', ' kami ', ' anda ', ' nak ', ' tak ', ' tidak ', ' ada ', ' untuk ', ' dengan ', ' boleh ', ' ini ', ' itu ', ' adalah ', ' pada ', ' dalam ', ' sudah ', ' dah ', ' macam ', ' kenapa ', ' bila ', ' siapa ', ' terima kasih ', ' salam ', 'berapa', 'macam mana', 'sila'];
  var MARKERS_EN = [' the ', ' you ', ' your ', ' is ', ' are ', ' have ', ' has ', ' please ', ' thanks ', ' thank you ', ' hello ', ' hi ', ' dear ', ' would ', ' could ', ' regards ', ' about ', ' with ', ' this ', ' that ', ' what ', ' when ', ' how ', ' our ', ' we ', ' i '];

  var INTENTS = [
    {
      id: 'complaint',
      label: 'Aduan',
      phrases: [
        ['sangat teruk', 3], ['servis teruk', 3], ['perkhidmatan teruk', 3], ['sangat lambat', 2.5], ['lambat sangat', 2.5],
        ['kecewa', 2.5], ['tidak puas hati', 3], ['tak puas hati', 3], ['marah', 2], ['bosan', 1.5],
        ['tidak dapat terima', 2], [' unacceptable', 3], ['disappointed', 2.5], ['terrible', 2.5], ['awful', 2.5],
        ['worst service', 3], ['fed up', 2.5], ['complaint', 2], ['aduan', 2.5], ['buruk', 2]
      ]
    },
    {
      id: 'billing',
      label: 'Pembayaran / Invois',
      phrases: [
        ['refund', 3], ['bayar balik', 3], ['wang saya', 2.5], ['duit saya', 2.5], ['invois', 2.5], ['invoice', 2.5],
        ['bayaran', 2], ['payment', 2], ['bil', 1.5], ['receipt', 2], ['resit', 2], ['caj', 2], ['charged', 2],
        ['dua kali', 2], ['double charge', 3], ['overcharge', 3], ['pengebilan', 2.5], ['billing', 2.5], ['bank', 1.5]
      ]
    },
    {
      id: 'support',
      label: 'Sokongan Teknikal',
      phrases: [
        ['tak boleh', 2], ['tidak berfungsi', 3], ['x boleh', 1.5], ['cannot', 2], ["can't", 2], ['not working', 3],
        ['error', 2.5], ['masalah', 2], ['problem', 2], ['issue', 2], ['bug', 2.5], ['rosak', 2],
        ['gagal', 2], ['failed', 2], ['log masuk', 2.5], ['log masuk tak', 3], ['login', 2], ['sign in', 2],
        ['crash', 2.5], ['hang', 1.5], ['stuck', 2], ['server down', 3], ['down', 1], ['bantuan teknikal', 2.5], ['help', 1.5]
      ]
    },
    {
      id: 'order',
      label: 'Pesanan / Penghantaran',
      phrases: [
        ['pesanan', 2.5], ['tempahan', 2.5], ['order', 2], ['beli', 1.5], ['purchase', 2],
        ['tracking', 2.5], ['penjejakan', 2.5], ['penghantaran', 2.5], ['delivery', 2.5], ['shipping', 2.5],
        ['parcel', 2.5], ['pakej', 2], ['package', 2], ['pos laju', 2.5], ['courier', 2], ['stok', 1.5], ['stock', 1.5],
        ['bila pesanan', 3], ['status pesanan', 3], ['akan sampai', 2], ['my order', 2.5]
      ]
    },
    {
      id: 'inquiry',
      label: 'Pertanyaan',
      phrases: [
        ['nak tanya', 2.5], ['mau tanya', 2.5], ['boleh terangkan', 2.5], ['berapa', 2.5], ['how much', 2.5],
        ['what is', 2.5], ['apa itu', 2.5], ['macam mana', 2], ['how to', 2], ['bagaimana', 2],
        ['question', 1.5], ['pertanyaan', 2.5], ['informasi', 2], ['info', 1], ['ada tak', 2.5], ['is there', 2],
        ['berminat', 1.5], ['interested', 1.5], ['harga', 2], ['price', 2]
      ]
    },
    {
      id: 'meeting',
      label: 'Jemputan Mesyuarat',
      phrases: [
        ['mesyuarat', 3], ['meeting', 3], ['temu janji', 2.5], ['appointment', 2.5], ['jadual', 2], ['schedule', 2],
        ['sesi', 1.5], ['call', 1.5], ['telefon', 1], ['zoom', 2.5], ['google meet', 2.5], ['teams', 2],
        ['available on', 2], ['masa sesuai', 2.5], ['demo', 2]
      ]
    },
    {
      id: 'application',
      label: 'Permohonan Kerja',
      phrases: [
        ['jawatan', 3], ['permohonan', 2.5], ['memohon', 2.5], ['resume', 2.5], ['cv ', 2.5], ['cover letter', 2.5],
        ['job', 2], ['kerja kosong', 2.5], ['vacancy', 2.5], ['position', 2], ['apply', 2], ['application for', 2.5],
        ['interview', 2], ['temu duga', 2.5], ['career', 2],
        ['permohonan jawatan', 4], ['memohon jawatan', 4], ['job application', 4]
      ]
    },
    {
      id: 'partnership',
      label: 'Kerjasama Perniagaan',
      phrases: [
        ['kerjasama', 3], ['kolaborasi', 3], ['collaboration', 3], ['partnership', 3], ['sponsor', 2.5],
        ['tawaran perniagaan', 3], ['business proposal', 3], ['cadangan projek', 2.5], ['mou', 2.5],
        ['vendor', 2], ['reseller', 2.5], ['bergerak bersama', 2]
      ]
    },
    {
      id: 'feedback_positive',
      label: 'Maklum Balas Positif',
      phrases: [
        ['terima kasih', 2.5], ['thanks', 2], ['thank you', 2.5], ['syabas', 2.5], ['bagus', 2], ['best', 1.5],
        ['cemerlang', 2.5], ['excellent', 2.5], ['great service', 2.5], ['memuaskan', 2.5], ['satisfied', 2],
        ['puas hati dengan servis', 3], ['appreciate', 2], ['hebat', 2.5], ['kudos', 2.5]
      ]
    },
    {
      id: 'spam',
      label: 'Spam',
      phrases: [
        ['anda menang', 4], ['tahniah anda menang', 5], ['you won', 4], ['you have won', 4], ['winner', 3],
        ['lottery', 4], ['loteri', 4], ['jackpot', 3.5], ['hadiah utama', 3.5], ['claim prize', 3.5],
        ['crypto', 2.5], ['bitcoin', 2], ['pelaburan pasti', 4], ['guaranteed profit', 4], ['untung cepat', 3.5],
        ['klik pautan', 2.5], ['click here', 2], ['klik sini', 2.5], ['free money', 3.5], ['wang percuma', 3.5],
        ['pinjaman mudah', 3], ['loan approved', 3], ['tanpa cek kredit', 2.5], ['vpn ', 1], ['terhad 24 jam', 3]
      ]
    }
  ];

  var SENSITIVE_INTENTS = ['billing', 'partnership', 'complaint'];

  var SENTIMENT_NEG = ['teruk', 'kecewa', 'marah', 'lambat', 'rosak', 'gagal', 'bosan', 'masalah', 'buruk', 'hampeh', 'cepatnya', 'mengecewakan', 'tidak berfungsi', 'tak berfungsi', 'tak boleh', 'tidak dapat', 'disappointed', 'terrible', 'awful', 'angry', 'frustrated', 'unacceptable', 'worst', 'poor', 'bad experience', 'down'];
  var SENTIMENT_POS = ['terima kasih', 'bagus', 'hebat', 'best', 'cemerlang', 'memuaskan', 'syabas', 'excellent', 'great', 'good', 'happy', 'satisfied', 'appreciate', 'wonderful', 'amazing', 'love'];
  var URGENT_WORDS = ['segera', 'urgent', 'asap', 'secepat mungkin', 'penting', 'eskalasi', 'escalate', 'deadline', 'kritikal', 'critical', 'emergency', 'kecemasan', 'darurat', 'cepat', 'immediately', 'hari ini juga'];
  var SENSITIVE_WORDS = ['invois', 'invoice', 'bayaran', 'payment', 'refund', 'bayar balik', 'wang', 'duit', 'bank', 'kad kredit', 'credit card', 'legal', 'guaman', 'saman', 'kontrak', 'contract', 'perjanjian', 'kata laluan', 'password', 'nombor akaun', 'account number', 'ssm', 'lhdn', 'cukai', 'tax'];

  // ------------------------------------------------------------------
  // Utiliti
  // ------------------------------------------------------------------

  function normalize(text) {
    return (' ' + String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9@.#\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() + ' ').replace(/\s+/g, ' ');
  }

  function countIn(haystack, needle) {
    var count = 0, idx = 0;
    if (!needle) return 0;
    while ((idx = haystack.indexOf(needle, idx)) !== -1) {
      count++;
      idx += needle.length - 1;
    }
    return count;
  }

  function detectLanguage(norm) {
    var ms = 0, en = 0, i;
    for (i = 0; i < MARKERS_MS.length; i++) ms += countIn(norm, MARKERS_MS[i]) > 0 ? 1 : 0;
    for (i = 0; i < MARKERS_EN.length; i++) en += countIn(norm, MARKERS_EN[i]) > 0 ? 1 : 0;
    return ms >= en ? 'ms' : 'en';
  }

  function firstNames(name) {
    return String(name || '').trim().split(/\s+/)[0] || 'Tuan/Puan';
  }

  function pick(arr, seed) {
    return arr[Math.floor((seed || Math.random()) * arr.length) % arr.length];
  }

  function stripSubject(subject) {
    var s = String(subject || '').replace(/^(re|fw|fwd)\s*:\s*/i, '').trim();
    return s.length > 90 ? s.slice(0, 87) + '…' : s;
  }

  // ------------------------------------------------------------------
  // Analisis
  // ------------------------------------------------------------------

  function analyze(email) {
    var text = normalize(email.subject + ' ' + email.body);
    var scores = {};
    var matched = {};

    INTENTS.forEach(function (intent) {
      var score = 0;
      intent.phrases.forEach(function (pair) {
        var phrase = normalize(pair[0]).trim();
        if (!phrase) return;
        if (text.indexOf(' ' + phrase + ' ') !== -1 || text.indexOf(phrase + ' ') === 1) {
          score += pair[1] * (1 + 0.15 * (countIn(text, phrase) - 1));
          (matched[intent.id] = matched[intent.id] || []).push(phrase);
        }
      });
      scores[intent.id] = Math.round(score * 100) / 100;
    });

    var sorted = Object.keys(scores).sort(function (a, b) { return scores[b] - scores[a]; });
    var top = sorted[0];
    var second = sorted[1];
    var topScore = scores[top] || 0;
    var secondScore = second ? scores[second] : 0;

    var intentId = topScore > 0 ? top : 'other';
    var confidence = topScore > 0
      ? Math.max(0.3, Math.min(0.98, topScore / (topScore + secondScore + 0.55)))
      : 0.3;

    // Sentimen
    var neg = 0, pos = 0, negHits = [], posHits = [];
    SENTIMENT_NEG.forEach(function (w) {
      var c = countIn(text, ' ' + normalize(w).trim() + ' ');
      if (c > 0) { neg += c; negHits.push(normalize(w).trim()); }
    });
    SENTIMENT_POS.forEach(function (w) {
      var c = countIn(text, ' ' + normalize(w).trim() + ' ');
      if (c > 0) { pos += c; posHits.push(normalize(w).trim()); }
    });
    var sentiment = neg > pos ? 'negative' : (pos > neg ? 'positive' : 'neutral');

    // Urgensi
    var urgentHits = [];
    URGENT_WORDS.forEach(function (w) {
      if (text.indexOf(' ' + normalize(w).trim() + ' ') !== -1) urgentHits.push(normalize(w).trim());
    });
    var urgency = urgentHits.length >= 2 ? 'high' : (urgentHits.length === 1 ? 'medium' : 'low');
    if (/\bdown!\b|!{2,}/.test(email.body || '')) urgency = urgency === 'low' ? 'medium' : 'high';

    // Sensitif
    var sensitiveHits = [];
    SENSITIVE_WORDS.forEach(function (w) {
      if (text.indexOf(' ' + normalize(w).trim() + ' ') !== -1) sensitiveHits.push(normalize(w).trim());
    });

    return {
      language: detectLanguage(text),
      intent: intentId,
      intentLabel: intentLabel(intentId),
      scores: scores,
      topScore: topScore,
      runnerUp: second ? { id: second, label: intentLabel(second), score: secondScore } : null,
      confidence: Math.round(confidence * 100) / 100,
      sentiment: sentiment,
      urgency: urgency,
      sensitive: sensitiveHits,
      keywords: dedupe((matched[intentId] || []).concat(negHits.slice(0, 2), posHits.slice(0, 2), urgentHits.slice(0, 2))).slice(0, 6),
      topic: stripSubject(email.subject)
    };
  }

  function intentLabel(id) {
    var found = INTENTS.filter(function (i) { return i.id === id; })[0];
    return found ? found.label : 'Lain-lain';
  }

  function dedupe(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }

  // ------------------------------------------------------------------
  // Penjanaan balasan
  // ------------------------------------------------------------------

  function greeting(name, lang, tone) {
    var first = firstNames(name);
    if (lang === 'en') return tone === 'santai' ? 'Hi ' + first + ',' : 'Dear ' + first + ',';
    return tone === 'santai' ? 'Hai ' + first + ',' : 'Salam ' + first + ',';
  }

  function closing(lang, tone) {
    if (lang === 'en') return tone === 'santai' ? 'Cheers,' : 'Best regards,';
    return tone === 'santai' ? 'Terima kasih!' : 'Sekian, terima kasih.';
  }

  function generateReply(email, analysis, config) {
    var lang = analysis.language;
    var tone = config.tone || 'formal';
    var name = email.from.name;
    var topic = analysis.topic;
    var r = Math.random();
    var bodyLines = [];

    var INTRO = {
      ms: {
        inquiry: ['Terima kasih atas pertanyaan anda berkenaan "' + topic + '".', 'Terima kasih kerana menghubungi kami berkenaan "' + topic + '".'],
        support: ['Terima kasih kerana melaporkan isu ini kepada kami.', 'Kami telah menerima laporan anda dan memahami betapa kurang menyenangkannya isu ini.'],
        order: ['Terima kasih atas emel anda berkenaan "' + topic + '".'],
        meeting: ['Terima kasih atas jemputan mesyuarat tersebut.'],
        application: ['Terima kasih atas minat anda untuk menyertai pasukan kami.'],
        billing: ['Terima kasih telah memaklumkan perkara ini kepada kami.', 'Kami sedang menyemak perkara berkenaan "' + topic + '".'],
        complaint: ['Kami mohon maaf yang tidak terhingga atas pengalaman yang kurang menyenangkan ini.'],
        partnership: ['Terima kasih atas tawaran kerjasama ini.'],
        feedback_positive: ['Terima kasih banyak atas kata-kata positif anda!', 'Terima kasih atas maklum balas yang menggalakkan ini!'],
        other: ['Terima kasih atas emel anda.'],
        spam: ['']
      },
      en: {
        inquiry: ['Thank you for your inquiry about "' + topic + '".', 'Thanks for reaching out to us regarding "' + topic + '".'],
        support: ['Thank you for reporting this issue to us.', 'We have received your report and understand how frustrating this must be.'],
        order: ['Thank you for your email regarding "' + topic + '".'],
        meeting: ['Thank you for the meeting invitation.'],
        application: ['Thank you for your interest in joining our team.'],
        billing: ['Thank you for bringing this to our attention.', 'We are currently reviewing the matter regarding "' + topic + '".'],
        complaint: ['We sincerely apologise for the unpleasant experience you have had.'],
        partnership: ['Thank you for this partnership proposal.'],
        feedback_positive: ['Thank you so much for your kind words!', 'Thank you for the encouraging feedback!'],
        other: ['Thank you for your email.'],
        spam: ['']
      }
    };

    var BODY = {
      ms: {
        inquiry: [
          'Pasukan kami akan menyediakan maklumat lengkap berkenaan pertanyaan anda dan akan memaklumkannya kepada anda melalui emel ini dalam masa 1–2 hari bekerja.',
          'Untuk maklumat anda, semua pertanyaan akan dilayan oleh pasukan khidmat pelanggan kami mengikut giliran. Kami akan kembali kepada anda dengan maklumat penuh secepat mungkin.'
        ],
        support: [
          'Sementara itu, anda boleh cuba langkah-langkah berikut:\n  1. Log keluar dan log masuk semula ke akaun anda.\n  2. Kosongkan cache pelayar anda dan muat semula halaman.\n  3. Pastikan aplikasi anda dikemas kini ke versi terkini.',
          'Isu anda telah direkodkan dalam sistem kami (Tiket #' + ticketNumber() + ') dan pasukan sokongan teknikal kami sedang menyiapkan penyelesaian.'
        ],
        order: [
          'Pesanan anda sedang dalam proses penghantaran. Nombor penjejakan (tracking number) akan dihantar kepada anda melalui emel sebaik sahaja paket berlepas dari pusat pengedaran kami.',
          'Status terkini pesanan anda sedang disemak. Penghantaran biasanya mengambil masa 3–5 hari bekerja untuk destinasi Semenanjung dan 5–8 hari bekerja untuk Sabah/Sarawak.'
        ],
        meeting: [
          'Saya berbesar hati untuk menghadirinya. Boleh anda sahkan semula tarikh, masa dan pautan mesyuarat? Waktu bekerja saya adalah ' + (config.hours || 'Isnin–Jumaat, 9:00 pagi – 5:00 petang') + '.'
        ],
        application: [
          'Permohonan anda telah diterima dengan lengkap dan sedang dinilai oleh pasukan sumber manusia kami. Sekiranya anda tersenarai untuk temu duga, kami akan menghubungi anda dalam tempoh dua (2) minggu dari tarikh ini.'
        ],
        billing: [
          'Pasukan kewangan kami sedang menyemak rekod bayaran anda dan akan menghubungi anda dalam masa 24 jam bekerja dengan status terkini.',
          'Untuk keselamatan akaun anda, sila JANGAN kongsi butiran kad kredit atau kata laluan melalui emel. Pasukan kami akan mengesahkan identiti anda melalui saluran rasmi.'
        ],
        complaint: [
          'Kami mengambil setiap aduan dengan serius dan laporan anda telah dieskalasikan terus kepada pengurusan kami. Seorang wakil yang bertanggungjawab akan menghubungi anda secara peribadi dalam masa 24 jam untuk menyelesaikan perkara ini.',
          'Keputusan ini bukan mencerminkan standard perkhidmatan kami. Kami sedang menyiasat punca isu ini dan akan menyediakan penyelesaian yang adil untuk anda.'
        ],
        partnership: [
          'Kami sangat terbuka untuk menerokai peluang kerjasama ini. Pasukan pembangunan perniagaan kami akan menghubungi anda tidak lama lagi untuk perbincangan lanjut.'
        ],
        feedback_positive: [
          'Sokongan seperti anda sangat bermakna bagi seluruh pasukan kami. Kami akan terus berusaha memberikan perkhidmatan yang terbaik!',
          'Kami gembira dapat membantu anda. Jangan segan untuk menghubungi kami semula pada masa hadapan.'
        ],
        other: [
          'Emel anda telah diterima dan dirujuk kepada pihak yang berkenaan. Kami akan memaklumkan anda sebaik sahaja terdapat perkembangan.'
        ]
      },
      en: {
        inquiry: [
          'Our team is preparing the complete information regarding your question and will update you through this email within 1–2 business days.',
          'All inquiries are handled by our customer service team on a first-come, first-served basis. We will get back to you with full details as soon as possible.'
        ],
        support: [
          'In the meantime, you may try the following steps:\n  1. Log out and log back in to your account.\n  2. Clear your browser cache and reload the page.\n  3. Make sure your app is updated to the latest version.',
          'Your issue has been logged in our system (Ticket #' + ticketNumber() + ') and our technical support team is working on a resolution.'
        ],
        order: [
          'Your order is currently being processed for delivery. A tracking number will be sent to you by email as soon as the parcel leaves our distribution centre.',
          'We are checking the latest status of your order. Delivery usually takes 3–5 business days for domestic addresses.'
        ],
        meeting: [
          'I would be happy to attend. Could you please confirm the date, time and meeting link? My working hours are ' + (config.hours || 'Monday–Friday, 9:00 AM – 5:00 PM') + '.'
        ],
        application: [
          'Your application has been received in full and is being reviewed by our human resources team. If you are shortlisted for an interview, we will contact you within two (2) weeks from this date.'
        ],
        billing: [
          'Our finance team is reviewing your payment records and will contact you within 24 business hours with the latest status.',
          'For your account security, please DO NOT share credit card details or passwords via email. Our team will verify your identity through official channels.'
        ],
        complaint: [
          'We take every complaint seriously and your report has been escalated directly to our management. A dedicated representative will contact you personally within 24 hours to resolve this matter.',
          'This experience does not reflect our service standards. We are investigating the root cause and will prepare a fair resolution for you.'
        ],
        partnership: [
          'We are open to exploring this collaboration opportunity. Our business development team will reach out to you shortly for further discussion.'
        ],
        feedback_positive: [
          'Support like yours means a lot to the whole team. We will keep striving to deliver our best service!',
          'We are glad we could help. Please do not hesitate to reach out again in the future.'
        ],
        other: [
          'Your email has been received and referred to the relevant party. We will keep you updated once there is any development.'
        ]
      }
    };

    var langPack = INTRO[lang] || INTRO.ms;
    var intro = pick(langPack[analysis.intent] || langPack.other, r);
    var body = pick((BODY[lang] || BODY.ms)[analysis.intent] || BODY.ms.other, r + 0.37);
    var line = (lang === 'en')
      ? (tone === 'santai' ? 'Thanks for your email about "' + topic + '".' : 'Thank you for your email regarding "' + topic + '".')
      : (tone === 'santai' ? 'Terima kasih atas emel pasal "' + topic + '".' : 'Terima kasih atas emel anda berkenaan "' + topic + '".');

    bodyLines.push(greeting(name, lang, tone));
    bodyLines.push('');
    if (intro && analysis.intent !== 'inquiry' && analysis.intent !== 'order' && analysis.intent !== 'feedback_positive') {
      bodyLines.push(intro);
      bodyLines.push('');
      if (analysis.intent === 'complaint') bodyLines.push(line);
      else bodyLines.push(body);
    } else {
      bodyLines.push(line);
      bodyLines.push('');
      bodyLines.push(body);
    }
    bodyLines.push('');
    bodyLines.push(closing(lang, tone));
    bodyLines.push(config.signature || 'Pasukan Khidmat Pelanggan');
    if (config.company) bodyLines.push(config.company);

    return {
      subject: 'Re: ' + stripSubject(email.subject),
      body: bodyLines.join('\n')
    };
  }

  function ticketNumber() {
    return String(Math.floor(10000 + Math.random() * 89999));
  }

  // ------------------------------------------------------------------
  // Keputusan (decision engine)
  // ------------------------------------------------------------------

  function decide(email, config) {
    var cfg = config || {};
    var threshold = typeof cfg.threshold === 'number' ? cfg.threshold : 0.8;
    var rawKw = cfg.alwaysReviewKeywords || [];
    var alwaysReview = (typeof rawKw === 'string' ? rawKw.split(',') : rawKw)
      .map(function (k) { return normalize(k).trim(); })
      .filter(Boolean);

    var analysis = analyze(email);
    var reply = generateReply(email, analysis, cfg);
    var pct = Math.round(analysis.confidence * 100);

    // 1. Spam
    if (analysis.intent === 'spam' && analysis.topScore >= 2.5) {
      return {
        analysis: analysis, reply: reply, action: 'spam',
        reason: 'Dikesan sebagai spam — kata kunci: ' + (analysis.keywords.slice(0, 3).join(', ') || 'corak spam')
      };
    }

    // 2. Kata kunci "sentiasa semak" daripada pengguna
    for (var i = 0; i < alwaysReview.length; i++) {
      if (normalize(email.subject + ' ' + email.body).indexOf(' ' + alwaysReview[i] + ' ') !== -1) {
        return {
          analysis: analysis, reply: reply, action: 'review',
          reason: 'Kata kunci semakan anda: "' + alwaysReview[i] + '" — perlu semakan manusia'
        };
      }
    }

    // 3. Niat sensitif (pembayaran, aduan, kerjasama)
    if (SENSITIVE_INTENTS.indexOf(analysis.intent) !== -1 && analysis.topScore >= 1.5) {
      return {
        analysis: analysis, reply: reply, action: 'review',
        reason: 'Topik sensitif (' + analysis.intentLabel + ') — balasan mewakili syarikat, perlu semakan manusia'
      };
    }

    // 4. Sentimen negatif
    if (analysis.sentiment === 'negative') {
      return {
        analysis: analysis, reply: reply, action: 'review',
        reason: 'Sentimen negatif dikesan (' + (analysis.keywords.slice(0, 3).join(', ') || 'nada emel') + ') — elak salah faham'
      };
    }

    // 5. Urgensi tinggi
    if (analysis.urgency === 'high') {
      return {
        analysis: analysis, reply: reply, action: 'review',
        reason: 'Tahap urgensi TINGGI — emel penting perlu perhatian manusia'
      };
    }

    // 6. Keyakinan rendah
    if (pct < Math.round(threshold * 100)) {
      return {
        analysis: analysis, reply: reply, action: 'review',
        reason: 'Keyakinan AI ' + pct + '% < ambang ' + Math.round(threshold * 100) + '% — AI tidak cukup pasti'
      };
    }

    // 7. Lulus semua — auto hantar
    return {
      analysis: analysis, reply: reply, action: 'auto_send',
      reason: 'Keyakinan ' + pct + '% ≥ ambang ' + Math.round(threshold * 100) + '% · niat: ' + analysis.intentLabel + ' · tiada isu sensitif'
    };
  }

  return {
    analyze: analyze,
    generateReply: generateReply,
    decide: decide,
    intentLabel: intentLabel,
    version: '1.0.0'
  };
});
