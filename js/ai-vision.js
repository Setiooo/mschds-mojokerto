/*
 * MSCHDS — Modul Analisis AI Fenomena via Webcam (Google Gemini)
 *
 * Webcam dipakai sebagai pengganti umpan CCTV. Tiap beberapa detik, satu frame
 * diambil, dikirim ke Google Gemini (generateContent), lalu deskripsi fenomena
 * ditampilkan real-time. Kunci API disimpan HANYA di browser (localStorage),
 * sehingga tidak ikut ter-commit ke repositori.
 *
 * PETA FUNGSI:
 *   initAiVision()      Memuat pengaturan tersimpan (key, model, interval, prompt) ke form.
 *   saveAiSettings()    Menyimpan pengaturan AI ke localStorage.
 *   startWebcam()       Menyalakan webcam & menampilkan ke elemen video.
 *   stopWebcam()        Mematikan webcam dan menghentikan analisis.
 *   toggleAnalysis()    Memulai/menghentikan loop analisis berkala.
 *   startAnalysis()     Memvalidasi & memulai interval analisis.
 *   stopAnalysis()      Menghentikan interval analisis.
 *   captureFrame()      Mengambil 1 frame video -> base64 JPEG.
 *   analyzeFrame()      Ambil frame -> kirim ke Gemini -> tampilkan hasil.
 *   callGemini(b64)     Memanggil API Gemini dengan gambar + prompt.
 *   renderAiResult(t)   Menampilkan hasil terbaru + menambah ke riwayat.
 *   setAiStatus(m,type) Memperbarui indikator status.
 *
 * Fungsi yang dipanggil dari atribut onclick di index.html diekspor ke window.
 */
(function () {
  'use strict';

  var AI = {
    stream: null,
    timer: null,
    running: false,
    busy: false,
    defaultPrompt:
      'Anda adalah sistem pemantauan CCTV kota Mojokerto. Amati gambar dan ' +
      'laporkan SINGKAT (maksimal 2 kalimat, Bahasa Indonesia) fenomena yang ' +
      'terjadi: tingkat keramaian, kepadatan/antrean kendaraan, potensi ' +
      'kerumunan, atau insiden/anomali. Jika sepi, sebutkan kondisi normal/sepi.'
  };

  function $(id) { return document.getElementById(id); }

  /** Memuat pengaturan tersimpan (key, model, interval, prompt) dari localStorage ke form. */
  function initAiVision() {
    if ($('aiKey')) $('aiKey').value = localStorage.getItem('mschds_ai_key') || '';
    if ($('aiModel')) $('aiModel').value = localStorage.getItem('mschds_ai_model') || 'gemini-1.5-flash';
    if ($('aiInterval')) $('aiInterval').value = localStorage.getItem('mschds_ai_interval') || '6';
    if ($('aiPrompt')) $('aiPrompt').value = localStorage.getItem('mschds_ai_prompt') || AI.defaultPrompt;
  }

  /** Menyimpan pengaturan AI ke localStorage (key tidak ikut ter-commit ke repo). */
  function saveAiSettings() {
    localStorage.setItem('mschds_ai_key', ($('aiKey').value || '').trim());
    localStorage.setItem('mschds_ai_model', $('aiModel').value);
    localStorage.setItem('mschds_ai_interval', $('aiInterval').value);
    localStorage.setItem('mschds_ai_prompt', $('aiPrompt').value);
    setAiStatus('pengaturan tersimpan', 'ok');
  }

  /** Menyalakan webcam pengguna dan menampilkannya pada elemen video. */
  async function startWebcam() {
    try {
      AI.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      $('aiWebcam').srcObject = AI.stream;
      setAiStatus('webcam aktif', 'ok');
    } catch (e) {
      setAiStatus('gagal akses webcam: ' + e.message, 'err');
    }
  }

  /** Mematikan webcam dan menghentikan analisis. */
  function stopWebcam() {
    stopAnalysis();
    if (AI.stream) { AI.stream.getTracks().forEach(function (t) { t.stop(); }); AI.stream = null; }
    if ($('aiWebcam')) $('aiWebcam').srcObject = null;
    setAiStatus('webcam mati', 'idle');
  }

  /** Memulai/menghentikan loop analisis berkala (dipanggil tombol). */
  function toggleAnalysis() {
    if (AI.running) stopAnalysis(); else startAnalysis();
  }

  /** Memvalidasi webcam & key lalu memulai interval analisis. */
  function startAnalysis() {
    if (!AI.stream) { setAiStatus('nyalakan webcam dulu', 'err'); return; }
    var key = (localStorage.getItem('mschds_ai_key') || ($('aiKey').value || '')).trim();
    if (!key) { setAiStatus('masukkan & simpan API key dulu', 'err'); return; }
    AI.running = true;
    if ($('aiBadge')) { $('aiBadge').classList.remove('hidden'); $('aiBadge').classList.add('flex'); }
    if ($('btnAiToggle')) { $('btnAiToggle').innerHTML = '<i data-lucide="pause" class="w-4 h-4"></i> Hentikan'; }
    if (window.lucide) lucide.createIcons();
    var sec = Math.max(3, parseInt($('aiInterval').value || '6', 10));
    analyzeFrame();
    AI.timer = setInterval(analyzeFrame, sec * 1000);
    setAiStatus('analisis berjalan tiap ' + sec + 's', 'ok');
  }

  /** Menghentikan interval analisis dan mengembalikan tampilan tombol. */
  function stopAnalysis() {
    AI.running = false;
    if (AI.timer) { clearInterval(AI.timer); AI.timer = null; }
    if ($('aiBadge')) { $('aiBadge').classList.add('hidden'); $('aiBadge').classList.remove('flex'); }
    if ($('btnAiToggle')) { $('btnAiToggle').innerHTML = '<i data-lucide="scan-eye" class="w-4 h-4"></i> Mulai Analisis'; }
    if (window.lucide) lucide.createIcons();
  }

  /** Mengambil satu frame dari video webcam dan mengubahnya menjadi base64 JPEG. */
  function captureFrame() {
    var v = $('aiWebcam'), c = $('aiCanvas');
    if (!v || !v.videoWidth) return null;
    var w = 640, h = Math.round((v.videoHeight / v.videoWidth) * 640);
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(v, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.7).split(',')[1];
  }

  /** Mengambil frame, mengirim ke Gemini, lalu menampilkan hasil analisis. */
  async function analyzeFrame() {
    if (AI.busy) return;
    var b64 = captureFrame();
    if (!b64) { setAiStatus('frame belum siap', 'err'); return; }
    AI.busy = true; setAiStatus('menganalisis...', 'run');
    try {
      var text = await callGemini(b64);
      renderAiResult(text);
      setAiStatus('OK ' + new Date().toLocaleTimeString('id-ID'), 'ok');
    } catch (e) {
      setAiStatus('error: ' + e.message, 'err');
    } finally {
      AI.busy = false;
    }
  }

  /** Memanggil Google Gemini generateContent dengan gambar + prompt; mengembalikan teks. */
  async function callGemini(b64) {
    var key = (localStorage.getItem('mschds_ai_key') || ($('aiKey').value || '')).trim();
    var model = localStorage.getItem('mschds_ai_model') || $('aiModel').value || 'gemini-1.5-flash';
    var prompt = localStorage.getItem('mschds_ai_prompt') || $('aiPrompt').value || AI.defaultPrompt;
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      model + ':generateContent?key=' + encodeURIComponent(key);
    var body = {
      contents: [{ parts: [ { text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: b64 } } ] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 220 }
    };
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      var t = await res.text();
      throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 140));
    }
    var data = await res.json();
    var cand = data && data.candidates && data.candidates[0];
    var parts = cand && cand.content && cand.content.parts;
    var out = parts ? parts.map(function (p) { return p.text || ''; }).join(' ').trim() : '';
    return out || '(model tidak mengembalikan teks)';
  }

  /** Menampilkan hasil terbaru dan menambahkannya ke daftar riwayat. */
  function renderAiResult(text) {
    if ($('aiLatest')) $('aiLatest').textContent = text;
    var log = $('aiLog');
    if (!log) return;
    var row = document.createElement('div');
    row.className = 'border-l-2 border-brand-500/50 pl-2';
    row.innerHTML = '<span class="text-[10px] text-gray-500">' +
      new Date().toLocaleTimeString('id-ID') + '</span><br>' + escapeHtml(text);
    log.prepend(row);
    while (log.children.length > 30) log.removeChild(log.lastChild);
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }

  /** Memperbarui indikator status kecil di bawah tombol. */
  function setAiStatus(msg, type) {
    var el = $('aiStatus');
    if (!el) return;
    var color = { ok: 'text-emerald-400', err: 'text-red-400', run: 'text-amber-400', idle: 'text-gray-500' }[type] || 'text-gray-500';
    el.className = 'text-[11px] self-center ' + color;
    el.textContent = 'Status: ' + msg;
  }

  // Ekspor fungsi yang dipakai atribut onclick di index.html
  window.startWebcam = startWebcam;
  window.stopWebcam = stopWebcam;
  window.toggleAnalysis = toggleAnalysis;
  window.saveAiSettings = saveAiSettings;

  // Inisialisasi form saat DOM siap
  if (document.readyState !== 'loading') initAiVision();
  else document.addEventListener('DOMContentLoaded', initAiVision);
})();
