# Kemas Kini Paparan Imej Markdown

Commit GitHub: `012cd7e` (`Fix rendering of Markdown images`)

## Cara pasang

1. Tutup Markdown Viewer.
2. Buat salinan sandaran folder projek anda.
3. Ekstrak kandungan ZIP ini ke root projek, iaitu folder yang mengandungi `main.js`.
4. Benarkan fail `package.json`, `preload.js`, dan `renderer.js` diganti.
5. Pastikan fail baharu `image-source.js` berada sebelah `main.js`.
6. Jalankan:

   ```bash
   npm install
   npm test
   npm start
   ```

7. Untuk bina installer Windows baharu:

   ```bash
   npm run build
   ```

## Fail dalam pakej

- `package.json` — memasukkan resolver dalam build dan arahan ujian.
- `preload.js` — mendedahkan resolver imej dan laluan drag-and-drop.
- `renderer.js` — menggunakan lokasi fail Markdown untuk imej relatif.
- `image-source.js` — resolver laluan imej baharu.
- `test/image-source.test.js` — ujian automatik (8 kes).

Contoh Markdown:

```md
![Gambar](img/gambar.png)
```
