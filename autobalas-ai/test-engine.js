/*
 * Ujian automatik Enjin AutoBalas AI
 * Jalankan: npm test
 */
const AI = require('./js/ai-engine.js');
const Demo = require('./js/demo-data.js');

const cfg = {
  threshold: 0.8,
  tone: 'formal',
  signature: 'Ahmad Faiz',
  company: 'Kedai TechMY',
  hours: 'Isnin–Jumaat, 9pagi–5petang',
  alwaysReviewKeywords: 'refund, guaman'
};

let pass = 0, fail = 0;

function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅', name); }
  else { fail++; console.log('  ❌', name, extra ? '→ ' + extra : ''); }
}

console.log('\n=== UJIAN ENJIN AUTOBALAS AI ===\n');

// 1. Klasifikasi asas
console.log('Klasifikasi niat:');
const cases = [
  { i: 0, intent: 'inquiry', action: 'auto_send' },
  { i: 1, intent: 'support', action: 'auto_send' },
  { i: 2, intent: 'complaint', action: 'review' },
  { i: 3, intent: 'billing', action: 'review' },
  { i: 4, intent: 'meeting', action: 'auto_send' },
  { i: 5, intent: 'spam', action: 'spam' },
  { i: 6, intent: 'application', action: 'auto_send' },
  { i: 7, intent: 'order', action: 'auto_send' },
  { i: 8, intent: 'partnership', action: 'review' },
  { i: 9, intent: 'spam', action: 'spam' },
  { i: 12, intent: 'support', action: 'review' },
  { i: 14, intent: 'billing', action: 'review' }
];
cases.forEach(function (c) {
  var d = AI.decide(Demo.POOL[c.i], cfg);
  check('"' + Demo.POOL[c.i].subject.slice(0, 38) + '" → ' + c.intent + '/' + c.action,
    d.analysis.intent === c.intent && d.action === c.action,
    'dapat ' + d.analysis.intent + '/' + d.action + ' (' + Math.round(d.analysis.confidence * 100) + '%)');
});

// 2. Pengesanan bahasa
console.log('\nPengesanan bahasa:');
check('Emel BM → ms', AI.decide(Demo.POOL[0], cfg).analysis.language === 'ms');
check('Emel EN → en', AI.decide(Demo.POOL[1], cfg).analysis.language === 'en');

// 3. Sentimen & urgensi
console.log('\nSentimen & urgensi:');
var dComplaint = AI.decide(Demo.POOL[2], cfg);
check('Aduan → sentimen negatif', dComplaint.analysis.sentiment === 'negative');
var dUrgent = AI.decide(Demo.POOL[12], cfg);
check('Server down → urgensi TINGGI', dUrgent.analysis.urgency === 'high');
check('Server down → perlu semakan', dUrgent.action === 'review');

// 4. Penjanaan balasan
console.log('\nPenjanaan balasan:');
var dInq = AI.decide(Demo.POOL[0], cfg);
check('Draf ada salam + nama penghantar', dInq.reply.body.indexOf('Salam Aina') !== -1);
check('Draf ada subjek Re:', dInq.reply.subject.indexOf('Re:') === 0);
check('Draf ada tandatangan', dInq.reply.body.indexOf('Ahmad Faiz') !== -1);
check('Draf ada syarikat', dInq.reply.body.indexOf('Kedai TechMY') !== -1);

var dEn = AI.decide(Demo.POOL[1], cfg);
check('Draf English ("Dear John")', dEn.reply.body.indexOf('Dear John') !== -1);

// Gaya santai
var dSantai = AI.decide(Demo.POOL[0], Object.assign({}, cfg, { tone: 'santai' }));
check('Gaya santai ("Hai Aina")', dSantai.reply.body.indexOf('Hai Aina') !== -1);

// 5. Kata kunci semakan pengguna
console.log('\nKata kunci semakan pengguna:');
var dKw = AI.decide(
  { from: { name: 'Test', email: 't@t.com' }, subject: 'Soalan biasa', body: 'Ini guaman kes mahkamah saya.' },
  cfg
);
check('Kata kunci "guaman" → review', dKw.action === 'review', dKw.reason);
check('Sebab sebut kata kunci', dKw.reason.indexOf('guaman') !== -1);

// 6. Ambang keyakinan
console.log('\nAmbang keyakinan:');
var dLow = AI.decide(Demo.POOL[15], Object.assign({}, cfg, { threshold: 0.95 }));
check('Ambang 95% → emel kabur jadi review', dLow.action === 'review');
var dAuto = AI.decide(Demo.POOL[0], Object.assign({}, cfg, { threshold: 0.5 }));
check('Ambang 50% → pertanyaan jadi auto', dAuto.action === 'auto_send');

// 7. Struktur balasan lengkap untuk semua emel (tiada crash)
console.log('\nKetahanan:');
var allOk = true;
Demo.POOL.forEach(function (e) {
  var d = AI.decide(e, cfg);
  if (!d.reply || !d.reply.body || !d.reply.subject || !d.reason) allOk = false;
});
check('Semua 16 emel diproses tanpa ralat', allOk);
check('Email kosong tidak crash', typeof AI.decide({ from: { name: 'x' }, subject: '', body: '' }, cfg).action === 'string');

console.log('\n==============================');
console.log('LULUS: ' + pass + ' | GAGAL: ' + fail);
console.log('==============================\n');
process.exit(fail > 0 ? 1 : 0);
