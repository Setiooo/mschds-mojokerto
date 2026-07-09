// MSCHDS — Konfigurasi tema Tailwind (dimuat setelah CDN Tailwind)
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#f0fbf7',
              100: '#d1f4e7',
              500: '#10b981', // Emerald utama
              600: '#059669',
              900: '#064e3b'
            },
            darkbg: '#0b0f19',
            cardbg: '#161e2e'
          }
        }
      }
    }
  