/*
 * AutoBalas AI — Data Demo (Simulasi Peti Masuk)
 * Emel-emas contoh dalam Bahasa Melayu & English untuk demonstrasi.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DemoData = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Pool emel demo — akan diproses oleh enjin AI semasa permulaan & mod live
  var POOL = [
    {
      from: { name: 'Aina Rahman', email: 'aina.rahman@gmail.com' },
      subject: 'Pertanyaan tentang produk skincare',
      body: 'Salam, saya nak tanya, produk serum vitamin C ni sesuai tak untuk kulit sensitif? Berapa harganya juga? Terima kasih.'
    },
    {
      from: { name: 'John Tan', email: 'john.tan@quickmail.com' },
      subject: 'Cannot login after latest update',
      body: 'Hi, after updating the app to version 2.4 I cannot login to my account. It keeps showing error code 502. Please help, I need to access my dashboard for work.'
    },
    {
      from: { name: 'Farah Idris', email: 'farah.idris@yahoo.com' },
      subject: 'Pesanan saya tak sampai lagi!!',
      body: 'Saya dah tunggu pesanan selama 2 minggu dan sampai sekarang tak receive apa-apa. Servis korang sangat teruk! Saya sangat kecewa dan nak penjelasan segera!'
    },
    {
      from: { name: 'Kumar Selvam', email: 'kumar.s@biznet.my' },
      subject: 'Minta refund — bayaran dipotong dua kali',
      body: 'Salam. Saya nak minta refund untuk invois #8812. Kad kredit saya kena caj bayaran dua kali untuk tempahan yang sama. Jumlah RM289.90. Sila balas wang saya secepat mungkin. Terima kasih.'
    },
    {
      from: { name: 'Emily Wong', email: 'emily.wong@corphub.com' },
      subject: 'Meeting request: Product demo next week',
      body: 'Hello, our team would like to schedule a product demo with you next week. Are you available on Tuesday or Wednesday afternoon? We can do a Zoom call. Please let me know your available time. Thanks!'
    },
    {
      from: { name: 'Lucky Draw Committee', email: 'winner-notice@megasweep.info' },
      subject: 'TAHNIAH!!! Anda Telah MENANG RM2,500,000',
      body: 'Tahniah! Anda telah menang hadiah utama loteri antarabangsa bernilai RM2,500,000! Klik pautan ini SEKARANG untuk claim prize anda. Tawaran terhad 24 jam sahaja. Jangan beritahu sesiapa!'
    },
    {
      from: { name: 'Hafiz Zulkifli', email: 'hafiz.zulkifli@gmail.com' },
      subject: 'Permohonan jawatan Designer Grafik',
      body: 'Salam sejahtera, saya ingin memohon jawatan Designer Grafik seperti diiklankan. Saya telah lampirkan resume dan portfolio saya. Saya mempunyai pengalaman 3 tahun dalam industri ini. Terima kasih atas pertimbangan pihak tuan.'
    },
    {
      from: { name: 'Nurul Ain', email: 'nurul.ain@gmail.com' },
      subject: 'Bila pesanan #A1023 akan sampai?',
      body: 'Hi, saya nak tanya status pesanan saya #A1023 yang saya buat hari Isnin lepas. Bila parcel akan sampai? Ada tracking number tak? Terima kasih.'
    },
    {
      from: { name: 'David Lim', email: 'david.lim@venturesasia.sg' },
      subject: 'Partnership proposal — collaboration opportunity',
      body: 'Dear Sir, I am writing to propose a business partnership between our companies. We believe a collaboration in the e-commerce space would bring great mutual benefits. Would you be open to a discussion? Best regards.'
    },
    {
      from: { name: 'Crypto Wealth Club', email: 'invest@getrichfast.biz' },
      subject: 'Guaranteed profit — double your money in 7 days!',
      body: 'Join our exclusive crypto investment club today! Guaranteed profit, double your money in just 7 days! Click here to register now. Limited slots available. Free money for early birds!'
    },
    {
      from: { name: 'Siti Maria', email: 'siti.maria@outlook.com' },
      subject: 'Terima kasih — servis yang sangat memuaskan',
      body: 'Salam, saya nak bagitahu yang servis korang memang excellent! Pakej sampai dengan cepat dan barang dalam keadaan baik. Terima kasih banyak, syabas kepada seluruh pasukan!'
    },
    {
      from: { name: 'Chong Wei', email: 'chong.wei@gmail.com' },
      subject: 'Pasal benda yang kita bincang tu',
      body: 'Hi, macam mana dah pasal benda yang kita bincang minggu lepas tu? Ada apa-apa perkembangan? Hope to hear from you soon.'
    },
    {
      from: { name: 'Roslan Abu', email: 'roslan.abu@techfirm.my' },
      subject: 'URGENT: Server down — semua operasi terhenti!',
      body: 'Server korang down sejak pagi! Semua staff tak boleh buat kerja dan system pencatatan waktu terus tidak berfungsi. Ini kritikal, kita rugi setiap jam. Tolong escalate segera, ini emergency!'
    },
    {
      from: { name: 'Mei Ling', email: 'mei.ling@globalshop.com' },
      subject: 'Do you ship to Singapore?',
      body: 'Hello, I love your products! Do you ship to Singapore and what are the shipping fees? Also, how long does delivery usually take? Thank you!'
    },
    {
      from: { name: 'Zulkarnain Hassan', email: 'zk.hassan@accountant.my' },
      subject: 'Official receipt required for LHDN filing',
      body: 'Salam, saya memerlukan official receipt untuk bayaran INV-2041 bagi tujuan pemfailan LHDN. Sila keluarkan resit rasmi atas nama syarikat kami. Ini penting untuk audit. Terima kasih.'
    },
    {
      from: { name: 'Aisyah Karim', email: 'aisyah.karim@gmail.com' },
      subject: 'Salam perkenalan',
      body: 'Salam, saya Aisyah. Saya baru berpindah ke kawasan ini dan teringin berkenalan dengan perniagaan tempatan di sini. Macam mana ye?'
    }
  ];

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function makeEmail(item, id, minutesAgo) {
    var now = Date.now();
    return {
      id: id,
      from: item.from,
      subject: item.subject,
      body: item.body,
      receivedAt: now - (minutesAgo || 0) * 60 * 1000,
      status: 'new',
      read: false
    };
  }

  // Seed awal: 8 emel dengan pelbagai usia (minit)
  function seedInitial() {
    var picks = [0, 2, 3, 4, 5, 6, 7, 10];
    var ages = [112, 95, 76, 61, 48, 35, 19, 6];
    return picks.map(function (idx, i) {
      return makeEmail(POOL[idx], 'em-' + Date.now() + '-' + i, ages[i]);
    });
  }

  // Generator live — mainikan pool berulang kali dalam susunan rawak
  function createPoolFeeder() {
    var queue = shuffle(POOL);
    var n = 0;
    return function next() {
      if (queue.length === 0) queue = shuffle(POOL);
      var item = queue.pop();
      n++;
      return makeEmail(item, 'em-' + Date.now() + '-' + n, 0);
    };
  }

  return {
    POOL: POOL,
    seedInitial: seedInitial,
    createPoolFeeder: createPoolFeeder
  };
});
