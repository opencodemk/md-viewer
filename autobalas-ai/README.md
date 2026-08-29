# 🤖 AutoBalas AI — Pembantu Emel Pintar

Aplikasi desktop (Electron) yang **membalas emel secara automatik menggunakan AI bawaan** — tanpa perlu API key, tanpa akaun sebenar. Dilengkapi **mod demo** dengan emel contoh Bahasa Melayu & English supaya anda boleh terus mencuba.

> ⚠️ Ini adalah **mod demo/simulasi**. Emel tidak dihantar ke mana-mana — semuanya berlaku di dalam aplikasi untuk demonstrasi cara kerja sistem.

---

## ✨ Ciri-ciri

| Ciri | Keterangan |
|------|------------|
| 🧠 **Analisis AI bawaan** | Klasifikasi niat emel (pertanyaan, aduan, sokongan, pesanan, invois, mesyuarat, permohonan kerja, kerjasama, spam), pengesanan sentimen & tahap urgensi |
| 🇲🇾 **Dwibahasa** | Mengesan & membalas dalam Bahasa Melayu atau English mengikut emel masuk |
| ⚖️ **Dua-dua mod balasan** | Emel biasa (keyakinan tinggi) → **auto-hantar**; emel sensitif/penting/sukar → **barisan semakan manusia** |
| 🚫 **Penapis spam** | Emel scam/loteri/crypto dikecam & disekat automatik |
| ✍️ **Draf boleh edit** | Draf AI boleh disemak, diedit, dan dihantar manual |
| ⚙️ **Tetapan fleksibel** | Ambang keyakinan auto-hantar, kata kunci "sentiasa semak", gaya bahasa (formal/santai), tandatangan, interval demo |
| 📋 **Log aktiviti** | Setiap keputusan AI direkodkan dengan alasan penuh |
| 💾 **Auto-simpan** | State aplikasi disimpan dalam `localStorage` |

## 🧠 Cara enjin AI membuat keputusan

Setiap emel dinilai mengikut turutan peraturan:

1. **Spam?** → sekat (kata kunci scam: *menang loteri, crypto, guaranteed profit…*)
2. **Kata kunci semakan anda?** → semakan manusia (cth: *refund, guaman, bank*)
3. **Topik sensitif?** (pembayaran/invois, aduan, kerjasama) → semakan manusia
4. **Sentimen negatif?** → semakan manusia (elak salah faham)
5. **Urgensi TINGGI?** → semakan manusia (emel penting)
6. **Keyakinan < ambang?** → semakan manusia (AI tidak pasti)
7. **Lulus semua** → ✅ **auto-hantar balasan**

Draf balasan dijana mengikut niat + bahasa + gaya bahasa yang dipilih, lengkap dengan nama penghantar, rujukan subjek, dan tandatangan anda.

## 🚀 Cara Menjalankan

### Mod Desktop (Electron)

```bash
cd autobalas-ai
npm install
npm start
```

### Mod Preview Pelayar (tanpa install Electron)

```bash
cd autobalas-ai
npm run preview        # → http://localhost:3000
```

### Ujian Enjin AI

```bash
npm test
```

## 📖 Panduan Demo

1. Buka aplikasi → 8 emel demo telah pun diproses oleh AI
2. Klik mana-mana emel → lihat **panel analisis AI** (niat, sentimen, urgensi, keyakinan %, kata kunci)
3. Folder **⚠️ Perlu Semakan** → edit draf & klik **Hantar Balasan**
4. Klik **📨 Terima Emel Sekarang** → tonton AI menganalisis emel baharu secara live
5. Buka **⚙️ Tetapan** → cuba laraskan ambang keyakinan atau tambah kata kunci semakan
6. Klik **↺ Set Semula Demo** untuk mula semula

## 📁 Struktur Projek

```
autobalas-ai/
├── main.js            # Proses utama Electron
├── preload.js         # Jambatan IPC selamat
├── index.html         # Antara muka
├── styles.css         # Tema gelap
├── server.js          # Server preview pelayar (tanpa dependency)
├── js/
│   ├── ai-engine.js   # 🧠 Enjin AI (analisis + penjanaan balasan + keputusan)
│   ├── demo-data.js   # Pool 16 emel demo (BM + English)
│   └── app.js         # Logik UI & pipeline live
└── test-engine.js     # Ujian automatik enjin AI
```

## 🔮 Langkah Seterusnya (bukan demo)

Untuk sambung ke emel sebenar kelak:
- **Gmail** → Google Cloud OAuth 2.0 + Gmail API
- **Mana-mana emel** → IMAP/SMTP (kata laluan aplikasi)
- **AI sebenar** → OpenAI / Claude API (gantikan `ai-engine.js`)

Struktur kod sedia direka supaya `ai-engine.js` boleh diganti tanpa mengubah UI.

## ⚖️ Lesen

MIT — sebahagian daripada repo `md-viewer`.
