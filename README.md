# 400 — Our Little Universe

Game hadiah 3D dari Sofiyan untuk Via, dibuat untuk merayakan api ke-400.

## Tujuan

Jelajahi empat babak taman bintang, uraikan Ragu dengan tembakan cahaya, kumpulkan 400 serpihan kenangan, dan jaga Cahayamu serta Api Kita. Setiap babak membuka pesan personal; babak terakhir berisi pertarungan bos dan surat untuk Via.

## Kontrol

- **WASD / tombol panah** — bergerak
- **Klik tahan / J** — menembakkan cahaya; tanpa arah mouse, serangan membidik Ragu terdekat
- **Space** — dash dengan kekebalan singkat
- **E** — Pulse Rindu saat energi penuh; memulihkan, merusak Ragu di sekitar, dan membersihkan proyektil
- **Esc / P** — jeda atau lanjut
- **Perangkat sentuh** — joystick kiri, tombol Cahaya, Dash, dan Rindu di kanan

## Menjalankan

```bash
npm install
npm run dev
```

Build produksi:

```bash
npm run build
npm run preview
```

## Deploy ke GitHub Pages

ZIP ini menyimpan proyek di dalam folder `app/`. Unggah isi ZIP dengan struktur folder tetap dipertahankan, termasuk folder `.github/` di sebelah `app/`. Workflow `.github/workflows/deploy.yml` akan menjalankan `npm ci` dan `npm run build` dari folder `app/`, lalu menerbitkan `app/dist/` setiap kali ada push ke branch `main`.

Di GitHub, buka **Settings → Pages**, lalu pilih **GitHub Actions** pada bagian **Build and deployment → Source**. Pastikan branch utama repository bernama `main`; bila namanya berbeda, sesuaikan pemicu branch di file workflow. Konfigurasi `base` otomatis mengikuti nama repository saat build GitHub Pages.

## Deploy ke Vercel

Impor repository GitHub ke Vercel, lalu atur:

- **Framework Preset:** Vite
- **Root Directory:** `app` (wajib karena `package.json` berada di folder ini)
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm ci`

Tidak ada backend atau variabel lingkungan yang dibutuhkan di Vercel. Musik tersedia lokal di `public/music/our-song.mp3`.

## Sistem utama

- Empat babak dengan komposisi musuh dan pesan berbeda
- Tiga jenis Ragu dengan perilaku berbeda dan bos dua fase
- Tembakan otomatis membidik, dash, pulse, kombo, magnet kenangan, dua sumber daya yang harus dijaga
- Skor terbaik, preferensi musik, dan kualitas tersimpan lokal di browser perangkat ini
- Kualitas HD/ECO dan degradasi otomatis saat frame rate rendah

## Teknik

React untuk shell/HUD, Three.js untuk dunia dan gameplay, geometri prosedural, instancing, pooled entities, shader langit/air/kelopak, bloom, fixed-timestep 60 Hz, serta Web Audio untuk efek suara.
