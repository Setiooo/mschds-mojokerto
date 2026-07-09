# MSCHDS — Mojokerto Smart Crowd & Human Development System

Website sistem pemantauan keramaian & CCTV Kota/Kabupaten Mojokerto: CCTV live resmi (ATCS), analitik kepadatan berbasis AI (simulasi), peta spasial, sistem pendukung keputusan (AI-DSS), dan grafik korelasi ekonomi.

> ⚠️ **Catatan kejujuran:** Panel *analitik AI* pada dashboard bersifat **simulasi/demo** (sudah diberi label). CCTV yang benar-benar live berasal dari **portal ATCS resmi** yang disematkan/ditautkan. Untuk stream CCTV asli, gunakan tombol "Buka Portal" atau ganti URL sesuai petunjuk di bawah.

---

## 📁 Struktur Folder

```
mschds-mojokerto/
├── index.html              # Struktur halaman (markup) seluruh website
├── css/
│   └── styles.css          # Gaya kustom tambahan di luar Tailwind
├── js/
│   ├── tailwind-config.js  # Konfigurasi tema Tailwind (warna brand, dll.)
│   └── app.js              # Seluruh logika aplikasi (29 fungsi, terdokumentasi)
├── assets/                 # Tempat menaruh gambar/logo/berkas statis (opsional)
├── README.md               # Berkas ini
└── DOKUMENTASI.md          # Pemetaan detail SETIAP fungsi kode
```

---

## 🚀 Cara Menjalankan (Siap Pakai)

### Cara 1 — Paling cepat
Klik dua kali **`index.html`** untuk membukanya di browser. Wajib ada **koneksi internet** karena memuat pustaka dari CDN (Tailwind, Leaflet, Chart.js, Lucide, HLS.js).

### Cara 2 — Server lokal (disarankan agar iframe & peta stabil)
Di dalam folder ini, jalankan salah satu:

```bash
# Python 3
python3 -m http.server 8080

# atau Node.js
npx serve .
```

Lalu buka `http://localhost:8080` di browser.

---

## 🌐 Ketergantungan (CDN)

| Pustaka      | Fungsi                                   |
|--------------|------------------------------------------|
| Tailwind CSS | Styling utama                            |
| Leaflet      | Peta spasial interaktif                  |
| Chart.js     | Grafik korelasi/tren                     |
| Lucide       | Ikon                                     |
| HLS.js       | Memutar stream CCTV format `.m3u8`       |

---

## ⚙️ Kustomisasi Cepat

- **Ganti titik kamera CCTV** → buka `js/app.js`, cari data `CAMERAS`/konfigurasi kamera di bagian atas berkas, ubah nama & koordinat `[lat, lng]`.
- **Pasang stream CCTV asli** → gunakan kolom "Integrasi Sumber CCTV" pada halaman, atau ubah nilai default di fungsi `loadCctvStream()` (mendukung `.m3u8` dan `.mp4`).
- **Ganti portal ATCS** → di `index.html`, cari `dishubcctv.mojokertokab.go.id` dan sesuaikan `src` iframe serta tautan tombol.
- **Ubah warna brand** → edit `js/tailwind-config.js` (palet `brand`) dan/atau `css/styles.css`.

---

## 🔗 Sumber CCTV & Info Resmi

- ATCS Dishub Mojokerto — https://dishubcctv.mojokertokab.go.id/
- SIMANJAKERTO (aplikasi) — Google Play Store
- Portal Pemkot Mojokerto — https://mojokertokota.go.id/

Lihat **DOKUMENTASI.md** untuk penjelasan setiap fungsi kode.

---

## 🤖 Fitur AI Live (Gemini) — opsional

Bagian **"AI Live"** memakai Google Gemini untuk mendeskripsikan fenomena pada webcam (pengganti CCTV) secara real-time.
- Butuh **Gemini API Key** (gratis di aistudio.google.com). Key **disimpan di browser saja**, tidak masuk ke repo.
- Langkah: buka menu **AI Live** → Nyalakan Webcam → tempel key → Simpan → Mulai Analisis.
- Untuk publik, lewatkan key via backend proxy agar tidak terekspos. Detail di DOKUMENTASI.md bagian 5.
