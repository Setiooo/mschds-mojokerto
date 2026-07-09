# DOKUMENTASI KODE — MSCHDS

Pemetaan lengkap setiap berkas dan **setiap fungsi** dalam proyek. Semua fungsi juga sudah diberi komentar dokumentasi langsung di atas definisinya di dalam `js/app.js`.

---

## 1. Peran Tiap Berkas

| Berkas | Peran |
|---|---|
| `index.html` | Kerangka/markup seluruh halaman: navbar, hero, CCTV live, dashboard (peta, log, feed AI, DSS, grafik), fitur, alur kerja, tentang, kontak, footer. Memuat CSS & JS eksternal. |
| `css/styles.css` | Gaya kustom tambahan (animasi, scrollbar, penyesuaian di luar Tailwind). |
| `js/tailwind-config.js` | Konfigurasi tema Tailwind: warna `brand`, `darkbg`, `cardbg`, dll. Dimuat **setelah** CDN Tailwind. |
| `js/app.js` | Seluruh logika aplikasi (state + 29 fungsi). |
| `assets/` | Folder untuk berkas statis (logo, gambar) bila diperlukan. |

---

## 2. Alur Inisialisasi (`window.onload`)

Saat halaman selesai dimuat, urutan berikut dijalankan:

1. `lucide.createIcons()` — merender semua ikon.
2. `startClock()` — menghidupkan jam realtime WIB.
3. `initMap()` — membangun peta + marker kamera.
4. `renderLogsTable()` — menampilkan tabel log awal.
5. `renderDSSList()` — menampilkan rekomendasi kebijakan.
6. `initTrendChart()` — membangun grafik korelasi.
7. `startSystemLoop()` — memulai pembaruan data berkala (real-time).

---

## 3. Peta Setiap Fungsi (`js/app.js`)

### 🎥 Modul CCTV & Feed Video
| Fungsi | Deskripsi |
|---|---|
| `loadCctvStream(url)` | Memuat & memutar stream CCTV (HLS `.m3u8` atau `.mp4`) ke elemen `<video>`; memakai HLS.js bila perlu. |
| `forcePlayCctv()` | Memaksa video diputar setelah interaksi pengguna (mengatasi blokir autoplay). |
| `setFeedMode(mode)` | Beralih antara mode "AI Canvas" (overlay deteksi) dan "Live Video". |
| `loadCustomStream()` | Memuat URL CCTV kustom yang dimasukkan pengguna. |
| `switchCamera(camId)` | Mengganti kamera aktif + memperbarui feed, peta, HUD. |

### 🤖 Modul Deteksi AI (Canvas)
| Fungsi | Deskripsi |
|---|---|
| `generateParticles(peopleCount, vehicleCount)` | Membuat objek deteksi acak (orang & kendaraan). |
| `renderCVFeed()` | Menggambar frame + kotak bounding deteksi ke `<canvas>` (loop animasi). |

### 🗺️ Modul Peta (Leaflet)
| Fungsi | Deskripsi |
|---|---|
| `initMap()` | Inisialisasi peta, layer tile dasar, marker kamera. |
| `toggleMapLayer(layer)` | Menyalakan/mematikan layer heat-spot / UMKM. |
| `updateMapBubbles()` | Memperbarui gelembung keramaian pada peta. |

### 📊 Modul Data & Dashboard
| Fungsi | Deskripsi |
|---|---|
| `getLiveCount(camId)` | Estimasi jumlah orang terkini pada kamera. |
| `calculateDensity(peopleCount)` | Kategori kepadatan (rendah/sedang/tinggi). |
| `generateInitialLogs()` | Membuat data log awal. |
| `renderLogsTable()` | Merender tabel log metadata. |
| `startSystemLoop()` | Loop utama pembaruan data berkala. |
| `updateDashboardData()` | Memperbarui statistik & indikator ringkas. |
| `changeTimeOfDay(val)` | Mengubah skenario waktu (pagi/siang/malam). |

### 🧠 Modul AI-DSS (Pendukung Keputusan)
| Fungsi | Deskripsi |
|---|---|
| `evaluateTimedPolicies(tod)` | Memunculkan rekomendasi kebijakan berbasis waktu. |
| `triggerMassGathering()` | Simulasi kerumunan massa mendadak. |
| `setOPDFilter(opd)` | Menyaring rekomendasi berdasarkan OPD/dinas. |
| `renderDSSList()` | Merender kartu rekomendasi kebijakan. |
| `ignorePolicy(id)` | Mengabaikan satu rekomendasi. |
| `dispatchPolicy(id)` | Mendisposisikan kebijakan ke OPD + catat riwayat. |

### 🪟 Modul Modal & Riwayat
| Fungsi | Deskripsi |
|---|---|
| `closeSuccessModal()` | Menutup modal sukses disposisi. |
| `toggleHistoryModal()` | Membuka/menutup modal riwayat. |
| `renderHistoryList()` | Merender daftar riwayat disposisi. |
| `clearHistoryLog()` | Menghapus seluruh riwayat. |

### ⏰ Modul Utilitas & Grafik
| Fungsi | Deskripsi |
|---|---|
| `startClock()` | Jam realtime (WIB) di header. |
| `initTrendChart()` | Inisialisasi grafik korelasi (Chart.js). |

---

## 4. Keterhubungan Antar Fungsi (ringkas)

```
window.onload
 ├─ startClock()
 ├─ initMap() ─────────────► marker kamera ──► switchCamera()
 ├─ renderLogsTable() ◄──── generateInitialLogs()
 ├─ renderDSSList() ◄────── evaluateTimedPolicies() / triggerMassGathering()
 │                           └─ dispatchPolicy() ──► renderHistoryList()
 ├─ initTrendChart()
 └─ startSystemLoop()
      ├─ updateDashboardData() ◄─ getLiveCount(), calculateDensity()
      ├─ updateMapBubbles()
      └─ renderCVFeed() ◄─ generateParticles()
```

Semua fungsi bertipe global (skrip klasik) sehingga dapat dipanggil langsung dari atribut `onclick` di `index.html`.

---

## 5. Modul Tambahan: Analisis AI Fenomena via Webcam (`js/ai-vision.js`)

Modul ini memakai **Google Gemini** untuk membaca "fenomena" pada umpan kamera (webcam sebagai pengganti CCTV) dan menampilkannya real-time. **Kunci API disimpan hanya di browser (localStorage)** — tidak ikut ter-commit ke repositori.

### Peta fungsi
| Fungsi | Deskripsi |
|---|---|
| `initAiVision()` | Memuat pengaturan tersimpan (key, model, interval, prompt) ke form saat halaman dibuka. |
| `saveAiSettings()` | Menyimpan pengaturan AI ke localStorage. |
| `startWebcam()` | Menyalakan webcam & menampilkan ke elemen video. |
| `stopWebcam()` | Mematikan webcam dan menghentikan analisis. |
| `toggleAnalysis()` | Memulai/menghentikan loop analisis berkala. |
| `startAnalysis()` / `stopAnalysis()` | Kontrol interval analisis. |
| `captureFrame()` | Mengambil 1 frame video → base64 JPEG. |
| `analyzeFrame()` | Ambil frame → kirim ke Gemini → tampilkan hasil. |
| `callGemini(b64)` | Memanggil endpoint `generateContent` Gemini (gambar + prompt). |
| `renderAiResult(text)` | Menampilkan hasil terbaru + menambah ke riwayat. |
| `setAiStatus(msg,type)` | Indikator status. |

### Cara pakai
1. Buka bagian **"AI Live"** di navbar.
2. Klik **Nyalakan Webcam** (izinkan akses kamera).
3. Tempel **Gemini API Key** di panel Pengaturan → **Simpan Pengaturan**.
4. Klik **Mulai Analisis**. Setiap N detik, fenomena akan muncul di "Fenomena terkini" dan tercatat di "Riwayat Fenomena".

### Keamanan key
- Aman untuk **uji lokal**. Untuk **publik (GitHub Pages)**, sebaiknya key dilewatkan lewat backend proxy kecil agar tidak terekspos.
- Dapatkan key gratis di Google AI Studio (aistudio.google.com).
