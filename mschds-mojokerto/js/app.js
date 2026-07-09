/*
 * MSCHDS — Logika Aplikasi (app.js)
 * Mojokerto Smart Crowd & Human Development System
 *
 * PETA FUNGSI (lihat DOKUMENTASI.md untuk detail lengkap):
 *   1. loadCctvStream()       Memuat & memutar stream CCTV (HLS .m3u8 atau MP4) ke elemen <video>; memakai Hls.js bila diperlukan.
 *   2. forcePlayCctv()        Memaksa pemutaran video CCTV setelah interaksi pengguna (mengatasi blokir autoplay browser).
 *   3. setFeedMode()          Beralih antara mode "AI Canvas" (overlay deteksi) dan "Live Video" pada panel feed.
 *   4. loadCustomStream()     Mengambil URL dari input pengguna lalu memuatnya sebagai sumber CCTV kustom.
 *   5. generateParticles()    Membuat data titik/objek acak untuk simulasi deteksi orang & kendaraan.
 *   6. renderCVFeed()         Menggambar frame video + kotak bounding deteksi AI ke <canvas> (loop animasi).
 *   7. switchCamera()         Mengganti kamera aktif serta memperbarui feed, peta, dan HUD.
 *   8. initMap()              Inisialisasi peta Leaflet, layer tile dasar, dan marker kamera CCTV.
 *   9. toggleMapLayer()       Menyalakan/mematikan layer peta (heat-spot keramaian / UMKM binaan).
 *  10. getLiveCount()         Menghitung estimasi jumlah orang terkini pada kamera tertentu.
 *  11. calculateDensity()     Menerjemahkan jumlah orang menjadi kategori kepadatan (rendah/sedang/tinggi).
 *  12. generateInitialLogs()  Membuat data awal log metadata kepadatan saat sistem pertama dijalankan.
 *  13. renderLogsTable()      Menampilkan / merender ulang tabel log metadata pada dashboard.
 *  14. startSystemLoop()      Memulai loop utama sistem yang memperbarui data secara berkala (real-time).
 *  15. updateDashboardData()  Memperbarui angka statistik ringkas & indikator pada dashboard.
 *  16. updateMapBubbles()     Memperbarui ukuran/warna gelembung keramaian pada peta sesuai data terbaru.
 *  17. changeTimeOfDay()      Mengubah skenario waktu (pagi/siang/malam) yang memengaruhi tingkat keramaian.
 *  18. evaluateTimedPolicies() Mengevaluasi & memunculkan rekomendasi kebijakan berdasarkan waktu.
 *  19. triggerMassGathering() Mensimulasikan kejadian kerumunan massa mendadak untuk pengujian sistem.
 *  20. setOPDFilter()         Menyaring daftar rekomendasi DSS berdasarkan OPD/dinas terpilih.
 *  21. renderDSSList()        Merender daftar kartu rekomendasi kebijakan (AI-DSS).
 *  22. ignorePolicy()         Mengabaikan / menutup satu rekomendasi kebijakan.
 *  23. dispatchPolicy()       Mendisposisikan rekomendasi kebijakan ke OPD terkait & mencatat riwayat.
 *  24. closeSuccessModal()    Menutup modal notifikasi keberhasilan disposisi.
 *  25. toggleHistoryModal()   Membuka / menutup modal riwayat disposisi kebijakan.
 *  26. renderHistoryList()    Merender daftar riwayat kebijakan yang telah didisposisikan.
 *  27. clearHistoryLog()      Menghapus seluruh riwayat disposisi.
 *  28. startClock()           Menjalankan jam realtime (WIB) di header.
 *  29. initTrendChart()       Inisialisasi grafik korelasi/tren memakai Chart.js.
 *
 * Orkestrasi: window.onload menjalankan startClock(), initMap(), renderLogsTable(),
 * renderDSSList(), initTrendChart(), lalu startSystemLoop().
 */

    // --- 1. CONFIG & GLOBAL STATE ---
    let map;
    let cameraMarkers = {};
    let cameraHeatCircles = {};
    let trendChartInstance;
    let cvAnimationId;
    let hls = null;
    let isVideoPlaying = false;
    let videoLoadTimer = null;

    // Elemen Video Pusat
    const realVideoEl = document.getElementById('realCctvVideo');
    const videoOverlay = document.getElementById('videoTapOverlay');

    // State Sistem Terintegrasi
    const simulationState = {
      selectedCamera: 'CAM-01',
      selectedOPD: 'ALL',
      timeOfDay: 'malam', 
      feedMode: 'asli', // Default: 'asli' (Kamera Live) agar pengguna langsung melihat video asli!
      isMassGatheringTriggered: false,
      dispatchedCount: 0,
      
      // Sumber Video (Menggunakan Google Storage yang teruji andal & mendukung CORS)
      cameras: {
        'CAM-01': {
          id: 'CAM-01',
          name: 'Alun-Alun Mojokerto',
          coords: [-7.4705, 112.4325],
          crowdScale: { pagi: 25, siang: 40, sore: 80, malam: 160 },
          vehicleScale: { pagi: 12, siang: 20, sore: 35, malam: 40 },
          videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' // Sangat stabil & CORS OK
        },
        'CAM-02': {
          id: 'CAM-02',
          name: 'Jl. Benteng Pancasila (Benpas)',
          coords: [-7.4764, 112.4435],
          crowdScale: { pagi: 10, siang: 15, sore: 55, malam: 120 },
          vehicleScale: { pagi: 8, siang: 10, sore: 40, malam: 65 },
          videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
        },
        'CAM-03': {
          id: 'CAM-03',
          name: 'Rest Area Gunung Gedangan',
          coords: [-7.4815, 112.4555],
          crowdScale: { pagi: 15, siang: 25, sore: 30, malam: 45 },
          vehicleScale: { pagi: 5, siang: 15, sore: 12, malam: 25 },
          videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'
        },
        'CAM-04': {
          id: 'CAM-04',
          name: 'Jl. Gajah Mada (Depan Pemkot)',
          coords: [-7.4682, 112.4358],
          crowdScale: { pagi: 90, siang: 75, sore: 110, malam: 30 },
          vehicleScale: { pagi: 65, siang: 50, sore: 80, malam: 15 },
          videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4'
        }
      },

      logs: [],
      dssList: [
        {
          id: 'DSS-001',
          opd: 'DISKOPUKM',
          opdName: 'Dinas Koperasi & UMKM',
          area: 'Jl. Benteng Pancasila',
          severity: 8.5,
          alertType: 'danger',
          title: 'Lonjakan Akselerasi Keramaian UMKM',
          desc: 'Kepadatan pengunjung di Benpas terpantau sangat tinggi malam ini. Direkomendasikan melakukan aktivasi pendataan izin usaha jemput bola (NIB) dan fasilitasi integrasi QRIS Bank Jatim langsung di lokasi.',
          status: 'pending'
        },
        {
          id: 'DSS-002',
          opd: 'DISNAKER',
          opdName: 'Dinas Tenaga Kerja',
          area: 'Alun-Alun Mojokerto',
          severity: 7.8,
          alertType: 'warning',
          title: 'Potensi Sentra Kewirausahaan Digital',
          desc: 'Jumlah usia produktif berkumpul di Alun-Alun melampaui batas normal. Direkomendasikan menyelenggarakan sosialisasi Bootcamp Pelatihan Kreator Konten di Balai Kelurahan terdekat guna peningkatan kapasitas pemuda pencari kerja.',
          status: 'pending'
        },
        {
          id: 'DSS-003',
          opd: 'SATPOLPP',
          opdName: 'Satpol PP & Dishub',
          area: 'Jl. Gajah Mada',
          severity: 9.2,
          alertType: 'critical',
          title: 'Titik Penyumbatan Arus Kendaraan',
          desc: 'Deteksi kemacetan akibat penumpukan parkir liar di bahu jalan Gajah Mada. Direkomendasikan pengerahan patroli pengamanan lalu lintas dinamis di zona rawan tersebut.',
          status: 'pending'
        }
      ],
      history: []
    };

    // --- 2. INITIALIZE APLIKASI ---
    window.onload = function() {
      lucide.createIcons();
      startClock();
      initMap();
      initTrendChart();
      generateInitialLogs();
      updateDashboardData();
      startSystemLoop();
      
      // Load Video pertama
      loadCctvStream(simulationState.cameras['CAM-01'].videoSrc);
      
      // Jalankan render loop canvas
      renderCVFeed();
    }

    // --- 3. PEMUTAR VIDEO & PENGATUR INTERAKSI SELULER ---
    /**
     * Memuat & memutar stream CCTV (HLS .m3u8 atau MP4) ke elemen <video>; memakai Hls.js bila diperlukan.
     */
    function loadCctvStream(url) {
      if (!url) return;
      isVideoPlaying = false;
      
      // Tampilkan kembali tombol perizinan autoplay (agar kompatibel di HP)
      if (simulationState.feedMode === 'asli') {
        videoOverlay.classList.remove('hidden');
      }

      if (hls) {
        hls.destroy();
        hls = null;
      }

      // Handler canplay & error sebelum menetapkan SRC
      realVideoEl.oncanplay = () => {
        isVideoPlaying = true;
        videoOverlay.classList.add('hidden');
        document.getElementById('hudResolution').innerText = "STREAM: 1080P@24FPS";
      };

      realVideoEl.onerror = (err) => {
        console.warn("Gagal memulai video, beralih ke cadangan: ", err);
        isVideoPlaying = false;
        videoOverlay.classList.add('hidden');
        document.getElementById('hudResolution').innerText = "CADANGAN: DETEKSI GENERATIF";
      };

      // Deteksi HLS (.m3u8)
      if (url.includes('.m3u8')) {
        if (Hls.isSupported()) {
          hls = new Hls({
            maxBidrate: 500000,
            enableWorker: true
          });
          hls.loadSource(url);
          hls.attachMedia(realVideoEl);
          hls.on(Hls.Events.MANIFEST_PARSED, function() {
            realVideoEl.play()
              .then(() => { isVideoPlaying = true; videoOverlay.classList.add('hidden'); })
              .catch(e => console.log("Autoplay diblokir di seluler"));
          });
        } else if (realVideoEl.canPlayType('application/vnd.apple.mpegurl')) {
          realVideoEl.src = url;
        }
      } else {
        // MP4 biasa
        realVideoEl.src = url;
        realVideoEl.load();
        realVideoEl.play()
          .then(() => { isVideoPlaying = true; videoOverlay.classList.add('hidden'); })
          .catch(e => console.log("Autoplay diblokir di seluler"));
      }

      // Berikan batas waktu: jika video gagal berputar dalam 3 detik, render animasi cadangan
      clearTimeout(videoLoadTimer);
      videoLoadTimer = setTimeout(() => {
        if (!isVideoPlaying && simulationState.feedMode === 'asli') {
          console.log("Menggunakan generator animasi cadangan...");
          videoOverlay.classList.add('hidden');
          document.getElementById('hudResolution').innerText = "OFFLINE: PROSEDURAL AI";
        }
      }, 3000);
    }

    // Aksi ketukan layar untuk memaksa video berputar di HP
    /**
     * Memaksa pemutaran video CCTV setelah interaksi pengguna (mengatasi blokir autoplay browser).
     */
    function forcePlayCctv() {
      realVideoEl.play()
        .then(() => {
          isVideoPlaying = true;
          videoOverlay.classList.add('hidden');
        })
        .catch(err => {
          console.error("Gagal memulai video: ", err);
          videoOverlay.classList.add('hidden');
        });
    }

    // Mengganti Mode Tab: Antara Emulasi Canvas & Live Video Feed Asli
    /**
     * Beralih antara mode "AI Canvas" (overlay deteksi) dan "Live Video" pada panel feed.
     */
    function setFeedMode(mode) {
      simulationState.feedMode = mode;
      
      const btnSim = document.getElementById('btnModeSimulasi');
      const btnAsli = document.getElementById('btnModeAsli');
      const hudType = document.getElementById('hudFeedType');
      const hudRes = document.getElementById('hudResolution');

      if (mode === 'simulasi') {
        btnSim.className = "px-3 py-1.5 rounded-t text-xs font-bold transition duration-150 border-b-2 border-brand-500 text-white";
        btnAsli.className = "px-3 py-1.5 rounded-t text-xs font-medium transition duration-150 text-gray-400 hover:text-white";
        hudType.innerText = "AI ENGINE EMULATION";
        hudRes.innerText = "SIMULASI: GPU-VIRTUAL";
        videoOverlay.classList.add('hidden');
        realVideoEl.pause();
      } else {
        btnSim.className = "px-3 py-1.5 rounded-t text-xs font-medium transition duration-150 text-gray-400 hover:text-white";
        btnAsli.className = "px-3 py-1.5 rounded-t text-xs font-bold transition duration-150 border-b-2 border-brand-500 text-white";
        hudType.innerText = "LIVE HD CCTV ANALYTICS";
        hudRes.innerText = "STREAM: 1080P@24FPS";
        
        if (!isVideoPlaying) {
          videoOverlay.classList.remove('hidden');
        }
        
        realVideoEl.play().catch(e => console.log(e));
        
        const cam = simulationState.cameras[simulationState.selectedCamera];
        document.getElementById('streamUrlInput').value = cam.videoSrc;
      }

      const currentData = getLiveCount(simulationState.selectedCamera);
      generateParticles(currentData.people, currentData.vehicles);
    }

    // Menghubungkan Tautan M3U8/MP4 Eksternal Kustom dari Input Pengguna
    /**
     * Mengambil URL dari input pengguna lalu memuatnya sebagai sumber CCTV kustom.
     */
    function loadCustomStream() {
      const url = document.getElementById('streamUrlInput').value.trim();
      if (url) {
        simulationState.cameras[simulationState.selectedCamera].videoSrc = url;
        loadCctvStream(url);
      }
    }

    // --- 4. ENGINE DETEKSI OBJEK (Drawn dynamically over background) ---
    const canvas = document.getElementById('cvCanvas');
    const ctx = canvas.getContext('2d');

    let particlePeople = [];
    let particleVehicles = [];

    // Partikel animasi latar belakang buatan jika video gagal/ditolak
    let backgroundStreetVehicles = [];

    /**
     * Membuat data titik/objek acak untuk simulasi deteksi orang & kendaraan.
     */
    function generateParticles(peopleCount, vehicleCount) {
      particlePeople = [];
      particleVehicles = [];
      backgroundStreetVehicles = [];
      
      // Human objects
      for(let i = 0; i < Math.min(peopleCount, 45); i++) {
        particlePeople.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          speedX: (Math.random() - 0.5) * 1.0,
          speedY: (Math.random() - 0.5) * 1.0,
          size: 7 + Math.random() * 5,
          label: 'Person: ' + (0.84 + Math.random()*0.15).toFixed(2)
        });
      }

      // Vehicle objects
      for(let i = 0; i < Math.min(vehicleCount, 10); i++) {
        particleVehicles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          speedX: (Math.random() - 0.5) * 1.8,
          speedY: (Math.random() - 0.5) * 1.8,
          w: 26 + Math.random()*10,
          h: 15 + Math.random()*4,
          label: Math.random() > 0.5 ? 'Car: ' + (0.87 + Math.random()*0.11).toFixed(2) : 'Motorcycle: ' + (0.79 + Math.random()*0.18).toFixed(2)
        });
      }

      // Animasi Latar Belakang Jalanan Alternatif (Simulasi Jalan Raya Malam Hari)
      for(let i = 0; i < 6; i++) {
        backgroundStreetVehicles.push({
          x: Math.random() * canvas.width,
          y: 40 + Math.random() * (canvas.height - 80),
          speed: 1.5 + Math.random() * 2,
          color: Math.random() > 0.5 ? '#facc15' : '#ef4444', 
          size: 4 + Math.random() * 3
        });
      }
    }

    // Loop Render Pemrosesan Citra Komputer
    /**
     * Menggambar frame video + kotak bounding deteksi AI ke <canvas> (loop animasi).
     */
    function renderCVFeed() {
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        const currentData = getLiveCount(simulationState.selectedCamera);
        generateParticles(currentData.people, currentData.vehicles);
      }

      let isDrawingVideoFrame = false;

      // Coba menggambar video jika mode asli aktif & siap diputar
      if (simulationState.feedMode === 'asli' && realVideoEl.readyState >= 2 && !realVideoEl.paused) {
        try {
          ctx.drawImage(realVideoEl, 0, 0, canvas.width, canvas.height);
          isDrawingVideoFrame = true;
        } catch (e) {
          isDrawingVideoFrame = false;
        }
      }

      // RENDERING CADANGAN: Jika tidak menggambar video frame, gambar animasi jalan raya interaktif
      if (!isDrawingVideoFrame) {
        // Background aspal gelap
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Menggambar Lajur Jalan Tengah
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        // Garis putus-putus pembatas jalan
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([15, 15]);
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2 - 25);
        ctx.lineTo(canvas.width, canvas.height / 2 - 25);
        ctx.moveTo(0, canvas.height / 2 + 25);
        ctx.lineTo(canvas.width, canvas.height / 2 + 25);
        ctx.stroke();
        ctx.setLineDash([]); // Reset pembatasan garis putus

        // Efek Visual Gerakan Mobil di Background (Siluet Cahaya Lampu)
        backgroundStreetVehicles.forEach(car => {
          car.x += car.speed;
          if (car.x > canvas.width) car.x = -20;

          // Menggambar bias cahaya lampu mobil malam hari
          let gradient = ctx.createRadialGradient(car.x, car.y, 2, car.x, car.y, car.size * 5);
          gradient.addColorStop(0, car.color);
          gradient.addColorStop(1, 'transparent');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(car.x, car.y, car.size * 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = car.color;
          ctx.beginPath();
          ctx.arc(car.x, car.y, car.size / 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Garis Scan Laser Scanning Hijau (HUD AI)
      const scanY = (Date.now() / 25) % canvas.height;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.04)';
      ctx.fillRect(0, 0, canvas.width, scanY);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(canvas.width, scanY);
      ctx.stroke();

      // Gambar Kotak Deteksi Pejalan Kaki (Hijau)
      particlePeople.forEach(person => {
        person.x += person.speedX;
        person.y += person.speedY;

        if (person.x < 0 || person.x > canvas.width) person.speedX *= -1;
        if (person.y < 0 || person.y > canvas.height) person.speedY *= -1;

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(person.x - person.size, person.y - person.size * 2, person.size * 2, person.size * 3);

        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(person.x, person.y - person.size, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 7.5px monospace';
        ctx.fillText(person.label, person.x - person.size, person.y - person.size * 2 - 3);
      });

      // Gambar Kotak Deteksi Kendaraan (Cyan)
      particleVehicles.forEach(v => {
        v.x += v.speedX;
        v.y += v.speedY;

        if (v.x < 0 || v.x > canvas.width) v.speedX *= -1;
        if (v.y < 0 || v.y > canvas.height) v.speedY *= -1;

        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(v.x, v.y, v.w, v.h);

        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 8px monospace';
        ctx.fillText(v.label, v.x, v.y - 3);
      });

      // Kotak HUD Informasi Total Objek Terhitung
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(canvas.width - 120, 10, 110, 45);
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1;
      ctx.strokeRect(canvas.width - 120, 10, 110, 45);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`HUMAN CNT: ${particlePeople.length}`, canvas.width - 110, 26);
      ctx.fillText(`VEHIC CNT: ${particleVehicles.length}`, canvas.width - 110, 41);

      cvAnimationId = requestAnimationFrame(renderCVFeed);
    }

    // Pergantian Kamera Aktif
    /**
     * Mengganti kamera aktif serta memperbarui feed, peta, dan HUD.
     */
    function switchCamera(camId) {
      simulationState.selectedCamera = camId;

      // Update CSS Tombol Aktif
      Object.keys(simulationState.cameras).forEach(id => {
        const btn = document.getElementById(`btnCam_${id}`);
        if (id === camId) {
          btn.className = "py-1.5 text-xs rounded transition font-medium border border-brand-500/30 bg-brand-900/40 text-brand-400";
        } else {
          btn.className = "py-1.5 text-xs rounded transition font-medium border border-gray-800 bg-gray-950 text-gray-400 hover:text-white";
        }
      });

      const cam = simulationState.cameras[camId];
      document.getElementById('currentCamId').innerText = cam.id;
      document.getElementById('currentCamLocation').innerText = cam.name;

      // Geser Center Peta Leaflet
      map.panTo(cam.coords, { animate: true, duration: 1.2 });
      cameraMarkers[camId].openPopup();

      // Memuat Aliran Stream Video CCTV yang Baru
      loadCctvStream(cam.videoSrc);
      document.getElementById('streamUrlInput').value = cam.videoSrc;

      // Sinkronisasi ulang partikel AI
      const counts = getLiveCount(camId);
      generateParticles(counts.people, counts.vehicles);
    }

    // --- 5. PETA LOKASI & VISUALISASI ---
    /**
     * Inisialisasi peta Leaflet, layer tile dasar, dan marker kamera CCTV.
     */
    function initMap() {
      map = L.map('map', {
        zoomControl: true,
        scrollWheelZoom: false
      }).setView([-7.4721, 112.4338], 14);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CartoDB'
      }).addTo(map);

      Object.keys(simulationState.cameras).forEach(camId => {
        const cam = simulationState.cameras[camId];
        
        const markerIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="w-4 h-4 bg-brand-500 rounded-full border-2 border-white shadow-lg animate-pulse" style="box-shadow: 0 0 10px #10b981;"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        const marker = L.marker(cam.coords, { icon: markerIcon }).addTo(map);
        
        marker.bindPopup(`
          <div class="text-xs text-gray-200">
            <h4 class="font-bold text-brand-400 border-b border-gray-800 pb-1 mb-1">${cam.name}</h4>
            <div class="flex flex-col gap-0.5">
              <span>ID: <code class="text-cyan-400 font-mono">${cam.id}</code></span>
              <span>Status Ingesti: <b class="text-emerald-400">Aktif</b></span>
              <button onclick="switchCamera('${cam.id}')" class="mt-2 w-full text-center bg-brand-500 hover:bg-brand-600 text-white text-[10px] font-semibold py-1 rounded transition">Pilih Kamera AI</button>
            </div>
          </div>
        `);

        cameraMarkers[camId] = marker;

        const heatCircle = L.circle(cam.coords, {
          color: '#ef4444',
          fillColor: '#f87171',
          fillOpacity: 0.15,
          radius: 100
        }).addTo(map);

        cameraHeatCircles[camId] = heatCircle;
      });

      const group = new L.featureGroup(Object.values(cameraMarkers));
      map.fitBounds(group.getBounds().pad(0.1));
    }

    let isUmkmLayerActive = false;
    let umkmMarkers = [];

    /**
     * Menyalakan/mematikan layer peta (heat-spot keramaian / UMKM binaan).
     */
    function toggleMapLayer(layer) {
      const btnHeat = document.getElementById('btnLayerHeat');
      const btnUmkm = document.getElementById('btnLayerUmkm');

      if (layer === 'heat') {
        Object.values(cameraHeatCircles).forEach(circle => {
          if (map.hasLayer(circle)) {
            map.removeLayer(circle);
            btnHeat.classList.replace('bg-brand-900/50', 'bg-gray-800');
            btnHeat.classList.replace('text-brand-400', 'text-gray-400');
          } else {
            circle.addTo(map);
            btnHeat.classList.replace('bg-gray-800', 'bg-brand-900/50');
            btnHeat.classList.replace('text-gray-400', 'text-brand-400');
          }
        });
      } else if (layer === 'umkm') {
        isUmkmLayerActive = !isUmkmLayerActive;
        if (isUmkmLayerActive) {
          btnUmkm.classList.replace('bg-gray-800', 'bg-brand-900/50');
          btnUmkm.classList.replace('text-gray-400', 'text-brand-400');

          const mockUmkmlocs = [
            [-7.4715, 112.4332, "UMKM Bakso Mojopahit", "Kuliner"],
            [-7.4760, 112.4440, "Sepatu Kreatif Benpas", "Kerajinan"],
            [-7.4772, 112.4431, "Grup Kuliner Terang Bulan", "Kuliner"],
            [-7.4810, 112.4550, "Sentra Oleh-oleh Mojokerto", "Fasilitasi"],
            [-7.4700, 112.4318, "Pujasera Alun-Alun Jaya", "Kuliner"]
          ];

          mockUmkmlocs.forEach(loc => {
            const umkmIcon = L.divIcon({
              className: 'umkm-icon',
              html: `<div class="w-3 h-3 bg-cyan-400 rounded-full border border-white shadow-md"></div>`,
              iconSize: [12, 12]
            });
            const m = L.marker([loc[0], loc[1]], { icon: umkmIcon })
              .bindPopup(`<div class="text-xs font-semibold text-gray-200">🏪 ${loc[2]}<br><span class="text-[10px] text-cyan-400">Kategori: ${loc[3]}</span></div>`)
              .addTo(map);
            umkmMarkers.push(m);
          });
        } else {
          btnUmkm.classList.replace('bg-brand-900/50', 'bg-gray-800');
          btnUmkm.classList.replace('text-brand-400', 'text-gray-400');
          umkmMarkers.forEach(m => map.removeLayer(m));
          umkmMarkers = [];
        }
      }
    }


    // --- 6. LOGIC & DATA GENERATOR (SIMULATION LOOP) ---
    /**
     * Menghitung estimasi jumlah orang terkini pada kamera tertentu.
     */
    function getLiveCount(camId) {
      const cam = simulationState.cameras[camId];
      const tod = simulationState.timeOfDay;
      let basePeople = cam.crowdScale[tod];
      let baseVehicles = cam.vehicleScale[tod];

      if (simulationState.isMassGatheringTriggered) {
        if (camId === 'CAM-01' || camId === 'CAM-02') {
          basePeople = Math.floor(basePeople * 2.5);
          baseVehicles = Math.floor(baseVehicles * 1.8);
        }
      }

      const randPeople = Math.max(2, basePeople + Math.floor((Math.random() - 0.5) * (basePeople * 0.15)));
      const randVehicles = Math.max(0, baseVehicles + Math.floor((Math.random() - 0.5) * (baseVehicles * 0.15)));

      return { people: randPeople, vehicles: randVehicles };
    }

    /**
     * Menerjemahkan jumlah orang menjadi kategori kepadatan (rendah/sedang/tinggi).
     */
    function calculateDensity(peopleCount) {
      if (peopleCount > 130) return { label: 'CRITICAL', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' };
      if (peopleCount > 80) return { label: 'HIGH', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
      if (peopleCount > 30) return { label: 'MEDIUM', color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' };
      return { label: 'LOW', color: 'text-gray-400 bg-gray-800/50 border-gray-700/20' };
    }

    /**
     * Membuat data awal log metadata kepadatan saat sistem pertama dijalankan.
     */
    function generateInitialLogs() {
      const now = new Date();
      for (let i = 0; i < 8; i++) {
        const time = new Date(now.getTime() - (i * 3000));
        const keys = Object.keys(simulationState.cameras);
        const randomCamId = keys[Math.floor(Math.random() * keys.length)];
        const counts = getLiveCount(randomCamId);
        
        simulationState.logs.unshift({
          timestamp: time.toLocaleTimeString('id-ID'),
          cameraId: randomCamId,
          location: simulationState.cameras[randomCamId].name,
          people: counts.people,
          vehicles: counts.vehicles,
          density: calculateDensity(counts.people)
        });
      }
      renderLogsTable();
    }

    /**
     * Menampilkan / merender ulang tabel log metadata pada dashboard.
     */
    function renderLogsTable() {
      const tbody = document.getElementById('dbLogTableBody');
      tbody.innerHTML = '';
      
      simulationState.logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-800/20 transition-colors duration-150";
        tr.innerHTML = `
          <td class="px-3 py-2 text-gray-400">${log.timestamp}</td>
          <td class="px-3 py-2 font-bold text-cyan-400">${log.cameraId}</td>
          <td class="px-3 py-2 text-gray-200 text-ellipsis overflow-hidden whitespace-nowrap max-w-[100px]">${log.location}</td>
          <td class="px-3 py-2 text-right font-bold text-white">${log.people}</td>
          <td class="px-3 py-2 text-center">
            <span class="text-[9px] px-2 py-0.5 rounded font-bold border ${log.density.color}">
              ${log.density.label}
            </span>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    /**
     * Memulai loop utama sistem yang memperbarui data secara berkala (real-time).
     */
    function startSystemLoop() {
      setInterval(() => {
        const keys = Object.keys(simulationState.cameras);
        const randomCamId = keys[Math.floor(Math.random() * keys.length)];
        const counts = getLiveCount(randomCamId);
        const logTime = new Date();

        simulationState.logs.unshift({
          timestamp: logTime.toLocaleTimeString('id-ID'),
          cameraId: randomCamId,
          location: simulationState.cameras[randomCamId].name,
          people: counts.people,
          vehicles: counts.vehicles,
          density: calculateDensity(counts.people)
        });

        if (simulationState.logs.length > 8) {
          simulationState.logs.pop();
        }

        renderLogsTable();
        updateDashboardData();
        updateMapBubbles();

        const currentData = getLiveCount(simulationState.selectedCamera);
        if (Math.random() > 0.6) {
          generateParticles(currentData.people, currentData.vehicles);
        }

      }, 3000);
    }

    /**
     * Memperbarui angka statistik ringkas & indikator pada dashboard.
     */
    function updateDashboardData() {
      let totalP = 0;
      Object.keys(simulationState.cameras).forEach(camId => {
        totalP += getLiveCount(camId).people;
      });

      document.getElementById('statTotalPeople').innerText = totalP;

      const pendingCount = simulationState.dssList.filter(d => d.status === 'pending').length;
      document.getElementById('statActivePolicies').innerText = pendingCount;
      document.getElementById('statActivePoliciesSubtitle').innerText = `${pendingCount} Butuh Disposisi`;

      document.getElementById('statDispatchedActions').innerText = simulationState.dispatchedCount;
      document.getElementById('dispatchHistoryCount').innerText = simulationState.dispatchedCount;

      renderDSSList();
    }

    /**
     * Memperbarui ukuran/warna gelembung keramaian pada peta sesuai data terbaru.
     */
    function updateMapBubbles() {
      Object.keys(simulationState.cameras).forEach(camId => {
        const counts = getLiveCount(camId);
        const circle = cameraHeatCircles[camId];
        if (!circle) return;
        
        let radius = 60 + (counts.people * 1.5);
        let color = '#06b6d4';
        let fill = '#22d3ee';

        if (counts.people > 130) {
          color = '#f43f5e';
          fill = '#fda4af';
        } else if (counts.people > 80) {
          color = '#f59e0b';
          fill = '#fde047';
        } else if (counts.people > 30) {
          color = '#10b981';
          fill = '#6ee7b7';
        }

        circle.setRadius(radius);
        circle.setStyle({
          color: color,
          fillColor: fill
        });
      });
    }

    /**
     * Mengubah skenario waktu (pagi/siang/malam) yang memengaruhi tingkat keramaian.
     */
    function changeTimeOfDay(val) {
      simulationState.timeOfDay = val;
      updateDashboardData();
      updateMapBubbles();
      
      const currentData = getLiveCount(simulationState.selectedCamera);
      generateParticles(currentData.people, currentData.vehicles);

      evaluateTimedPolicies(val);
    }

    /**
     * Mengevaluasi & memunculkan rekomendasi kebijakan berdasarkan waktu.
     */
    function evaluateTimedPolicies(tod) {
      if (tod === 'malam') {
        simulationState.dssList = [
          {
            id: 'DSS-001',
            opd: 'DISKOPUKM',
            opdName: 'Dinas Koperasi & UMKM',
            area: 'Jl. Benteng Pancasila',
            severity: 8.5,
            alertType: 'danger',
            title: 'Lonjakan Akselerasi Keramaian UMKM',
            desc: 'Kepadatan pengunjung di Benpas terpantau sangat tinggi malam ini. Direkomendasikan melakukan aktivasi pendataan izin usaha jemput bola (NIB) dan fasilitasi integrasi QRIS Bank Jatim langsung di lokasi.',
            status: 'pending'
          },
          {
            id: 'DSS-002',
            opd: 'DISNAKER',
            opdName: 'Dinas Tenaga Kerja',
            area: 'Alun-Alun Mojokerto',
            severity: 7.8,
            alertType: 'warning',
            title: 'Potensi Sentra Kewirausahaan Digital',
            desc: 'Jumlah usia produktif berkumpul di Alun-Alun melampaui batas normal. Direkomendasikan menyelenggarakan sosialisasi Bootcamp Pelatihan Kreator Konten di Balai Kelurahan terdekat guna peningkatan kapasitas pemuda pencari kerja.',
            status: 'pending'
          },
          {
            id: 'DSS-003',
            opd: 'SATPOLPP',
            opdName: 'Satpol PP & Dishub',
            area: 'Jl. Gajah Mada',
            severity: 9.2,
            alertType: 'critical',
            title: 'Titik Penyumbatan Arus Kendaraan',
            desc: 'Deteksi kemacetan akibat penumpukan parkir liar di bahu jalan Gajah Mada. Direkomendasikan pengerahan patroli pengamanan lalu lintas dinamis di zona rawan tersebut.',
            status: 'pending'
          }
        ];
      } else if (tod === 'siang') {
        simulationState.dssList = [
          {
            id: 'DSS-004',
            opd: 'DISKOPUKM',
            opdName: 'Dinas Koperasi & UMKM',
            area: 'Rest Area Gunung Gedangan',
            severity: 6.5,
            alertType: 'warning',
            title: 'Zona Ekonomi Kurang Produktif',
            desc: 'Arus pengunjung sangat sepi di Rest Area siang ini. Direkomendasikan koordinasi mikro menyusun kalender pameran kerajinan produk lokal berjadwal agar merangsang kunjungan pembeli.',
            status: 'pending'
          },
          {
            id: 'DSS-005',
            opd: 'SATPOLPP',
            opdName: 'Satpol PP & Dishub',
            area: 'Jl. Gajah Mada (Depan Kantor Pemkot)',
            severity: 8.9,
            alertType: 'danger',
            title: 'Puncak Arus Kemacetan Kerja',
            desc: 'Arus lalu lintas siang hari didominasi kendaraan dinas & perkantoran yang parkir tidak rapi. Direkomendasikan pengaturan lajur satu arah khusus parkir siang hari.',
            status: 'pending'
          }
        ];
      } else if (tod === 'pagi') {
        simulationState.dssList = [
          {
            id: 'DSS-006',
            opd: 'DISNAKER',
            opdName: 'Dinas Tenaga Kerja',
            area: 'Kelurahan Gedangan',
            severity: 7.2,
            alertType: 'warning',
            title: 'Sosialisasi Literasi Keuangan Pagi',
            desc: 'Pola pergerakan warga pasar menunjukkan tingkat kesiapan interaksi ekonomi tinggi di pagi hari. Direkomendasikan menempatkan Mobil Pendampingan Usaha Keliling di dekat pasar tradisional.',
            status: 'pending'
          }
        ];
      } else if (tod === 'sore') {
        simulationState.dssList = [
          {
            id: 'DSS-007',
            opd: 'SATPOLPP',
            opdName: 'Satpol PP & Dishub',
            area: 'Alun-Alun Mojokerto',
            severity: 9.5,
            alertType: 'critical',
            title: 'Peningkatan Kepadatan Kerumunan Senja',
            desc: 'Keluarga & anak-anak berkumpul masif di Alun-Alun. Dibutuhkan penyebaran petugas pamong praja wanita untuk mengimbau ketertiban ruang publik secara persuasif.',
            status: 'pending'
          }
        ];
      }

      updateDashboardData();
    }

    /**
     * Mensimulasikan kejadian kerumunan massa mendadak untuk pengujian sistem.
     */
    function triggerMassGathering() {
      simulationState.isMassGatheringTriggered = true;
      
      const newUrgentAlert = {
        id: 'DSS-ALARM-' + Math.floor(Math.random() * 1000),
        opd: 'SATPOLPP',
        opdName: 'Satpol PP & Dishub',
        area: 'Alun-Alun Mojokerto',
        severity: 9.8,
        alertType: 'critical',
        title: 'ALERT: Kerumunan Massa Tak Terjadwal!',
        desc: 'Sistem mendeteksi lonjakan massa mendadak di area timur Alun-Alun Mojokerto (> 300 orang). Segera berangkatkan mobil patroli penertiban bersama kepolisian setempat.',
        status: 'pending'
      };

      simulationState.dssList.unshift(newUrgentAlert);

      map.setView([-7.4705, 112.4325], 15);
      cameraMarkers['CAM-01'].openPopup();

      const currentData = getLiveCount('CAM-01');
      generateParticles(currentData.people, currentData.vehicles);

      updateDashboardData();
      updateMapBubbles();

      const mapDiv = document.getElementById('map');
      mapDiv.classList.add('ring-4', 'ring-rose-500', 'ring-offset-2', 'ring-offset-darkbg');
      setTimeout(() => {
        mapDiv.classList.remove('ring-4', 'ring-rose-500', 'ring-offset-2', 'ring-offset-darkbg');
      }, 3000);
    }


    // --- 7. SISTEM PENDUKUNG KEPUTUSAN (DSS) RENDERER ---
    /**
     * Menyaring daftar rekomendasi DSS berdasarkan OPD/dinas terpilih.
     */
    function setOPDFilter(opd) {
      simulationState.selectedOPD = opd;
      
      const opds = ['ALL', 'DISNAKER', 'DISKOPUKM', 'SATPOLPP'];
      opds.forEach(o => {
        const btn = document.getElementById(`opdFilter_${o}`);
        if (o === opd) {
          btn.className = "py-1 rounded font-medium transition bg-gray-800 text-white";
        } else {
          btn.className = "py-1 rounded font-medium transition text-gray-400 hover:text-white";
        }
      });

      renderDSSList();
    }

    /**
     * Merender daftar kartu rekomendasi kebijakan (AI-DSS).
     */
    function renderDSSList() {
      const container = document.getElementById('dssContainer');
      container.innerHTML = '';

      const filtered = simulationState.dssList.filter(item => {
        if (item.status !== 'pending') return false;
        if (simulationState.selectedOPD === 'ALL') return true;
        return item.opd === simulationState.selectedOPD;
      });

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500">
            <i data-lucide="badge-check" class="w-10 h-10 text-emerald-500 mb-2"></i>
            <p class="text-xs font-bold text-gray-400">Semua Masalah Teratasi</p>
          </div>
        `;
        lucide.createIcons();
        return;
      }

      filtered.forEach(item => {
        const card = document.createElement('div');
        
        let colorClass = 'border-amber-500/30 bg-amber-950/20';
        let badgeClass = 'bg-amber-400/10 text-amber-400 border-amber-400/20';
        let severityColor = 'text-amber-400';
        
        if (item.alertType === 'critical') {
          colorClass = 'border-rose-500/30 bg-rose-950/20';
          badgeClass = 'bg-rose-400/10 text-rose-400 border-rose-400/20';
          severityColor = 'text-rose-400';
        } else if (item.alertType === 'danger') {
          colorClass = 'border-purple-500/30 bg-purple-950/20';
          badgeClass = 'bg-purple-400/10 text-purple-400 border-purple-400/20';
          severityColor = 'text-purple-400';
        }

        card.className = `p-3 rounded-lg border ${colorClass} flex flex-col gap-2 relative overflow-hidden`;
        card.innerHTML = `
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${badgeClass}">
                ${item.opdName}
              </span>
              <h3 class="font-bold text-white text-xs mt-1.5">${item.title}</h3>
              <p class="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                <i data-lucide="map-pin" class="w-3 h-3"></i> ${item.area}
              </p>
            </div>
            <div class="text-right">
              <span class="font-mono font-bold text-sm ${severityColor}">${item.severity.toFixed(1)}</span>
            </div>
          </div>
          
          <p class="text-[11px] text-gray-300 leading-relaxed bg-black/40 p-2 rounded border border-gray-800/60 mt-1">
            ${item.desc}
          </p>

          <div class="flex gap-2 justify-end mt-1">
            <button onclick="ignorePolicy('${item.id}')" class="px-2.5 py-1 text-[10px] rounded border border-gray-800 text-gray-400 hover:text-white transition">Abaikan</button>
            <button onclick="dispatchPolicy('${item.id}')" class="px-3 py-1 text-[10px] rounded bg-brand-500 hover:bg-brand-600 text-white font-bold flex items-center gap-1 transition">
              <i data-lucide="send" class="w-3 h-3"></i> Disposisi
            </button>
          </div>
        `;
        container.appendChild(card);
      });

      lucide.createIcons();
    }

    /**
     * Mengabaikan / menutup satu rekomendasi kebijakan.
     */
    function ignorePolicy(id) {
      simulationState.dssList = simulationState.dssList.filter(item => item.id !== id);
      updateDashboardData();
    }

    /**
     * Mendisposisikan rekomendasi kebijakan ke OPD terkait & mencatat riwayat.
     */
    function dispatchPolicy(id) {
      const idx = simulationState.dssList.findIndex(item => item.id === id);
      if (idx !== -1) {
        const policy = simulationState.dssList[idx];
        policy.status = 'resolved';

        simulationState.dispatchedCount++;
        const now = new Date();
        simulationState.history.unshift({
          ticketId: `MS-DSS-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 900 + 100)}`,
          timestamp: now.toLocaleString('id-ID'),
          opd: policy.opdName,
          location: policy.area,
          actionText: policy.desc,
          severity: policy.severity
        });

        document.getElementById('modalTicketId').innerText = simulationState.history[0].ticketId;
        document.getElementById('modalOPD').innerText = policy.opdName.toUpperCase();
        document.getElementById('modalLocation').innerText = policy.area;
        document.getElementById('modalAction').innerText = policy.desc;

        if (id.startsWith('DSS-ALARM-')) {
          simulationState.isMassGatheringTriggered = false;
        }

        document.getElementById('successModal').classList.remove('hidden');

        simulationState.dssList.splice(idx, 1);
        updateDashboardData();
      }
    }

    /**
     * Menutup modal notifikasi keberhasilan disposisi.
     */
    function closeSuccessModal() {
      document.getElementById('successModal').classList.add('hidden');
    }


    // --- 8. HISTORIS DISPOSISI MODAL ---
    /**
     * Membuka / menutup modal riwayat disposisi kebijakan.
     */
    function toggleHistoryModal() {
      const modal = document.getElementById('historyModal');
      if (modal.classList.contains('hidden')) {
        renderHistoryList();
        modal.classList.remove('hidden');
      } else {
        modal.classList.add('hidden');
      }
    }

    /**
     * Merender daftar riwayat kebijakan yang telah didisposisikan.
     */
    function renderHistoryList() {
      const container = document.getElementById('historyListContainer');
      container.innerHTML = '';

      if (simulationState.history.length === 0) {
        container.innerHTML = `
          <div class="text-center py-10 text-gray-500">
            <i data-lucide="folder-open" class="w-12 h-12 mx-auto text-gray-700 mb-2"></i>
            <p class="text-xs">Belum ada riwayat disposisi kebijakan yang tersimpan.</p>
          </div>
        `;
        lucide.createIcons();
        return;
      }

      simulationState.history.forEach(item => {
        const block = document.createElement('div');
        block.className = "bg-gray-950 p-3 rounded-lg border border-gray-800 text-xs flex flex-col gap-1";
        block.innerHTML = `
          <div class="flex justify-between items-center border-b border-gray-900 pb-1.5 mb-1.5">
            <span class="font-bold text-brand-400 font-mono">${item.ticketId}</span>
            <span class="text-[10px] text-gray-500">${item.timestamp}</span>
          </div>
          <div><span class="text-gray-500">OPD Eksekutor :</span> <span class="text-white font-semibold">${item.opd}</span></div>
          <div><span class="text-gray-500">Lokasi Sasaran:</span> <span class="text-gray-300">${item.location}</span></div>
          <div><span class="text-gray-500">Rencana Kerja :</span> <p class="text-gray-400 italic mt-0.5">${item.actionText}</p></div>
          <div class="mt-2 flex justify-between items-center">
            <span class="text-[10px] text-emerald-400 flex items-center gap-1">✔ Disposisi Terkirim</span>
          </div>
        `;
        container.appendChild(block);
      });

      lucide.createIcons();
    }

    /**
     * Menghapus seluruh riwayat disposisi.
     */
    function clearHistoryLog() {
      simulationState.history = [];
      simulationState.dispatchedCount = 0;
      updateDashboardData();
      renderHistoryList();
    }


    // --- KLOK REALTIME ---
    /**
     * Menjalankan jam realtime (WIB) di header.
     */
    function startClock() {
      const el = document.getElementById("liveClock");
      if (!el) return;
      const tick = () => { el.innerText = new Date().toLocaleTimeString("id-ID"); };
      tick();
      setInterval(tick, 1000);
    }

    // --- 9. INTI DIAGRAM TREN ---
    /**
     * Inisialisasi grafik korelasi/tren memakai Chart.js.
     */
    function initTrendChart() {
      const ctx = document.getElementById('trendChart').getContext('2d');
      trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
          datasets: [{
            label: 'Indeks Kerumunan Publik (Orang)',
            data: [65, 59, 80, 81, 156, 320, 290],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4
          }, {
            label: 'Omset Rata-rata UMKM (Ribu Rp)',
            data: [120, 115, 140, 155, 230, 480, 410],
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                color: '#9ca3af',
                font: { size: 9 }
              }
            }
          },
          scales: {
            x: {
              grid: { color: '#1f2937' },
              ticks: { color: '#9ca3af', font: { size: 8 } }
            },
            y: {
              grid: { color: '#1f2937' },
              ticks: { color: '#9ca3af', font: { size: 8 } }
            }
          }
        }
      });
    }

  