# 🏆 Olimpiakids - Lomba Bayi (Baby Crawling Race)

Aplikasi web modern untuk manajemen lomba merangkak bayi dan live leaderboard pertandingan secara realtime. Dirancang khusus untuk panitia lomba (juri) dan layar proyektor penonton/orang tua.

---

## 🚀 Fitur Utama

- **Papan Skor Live Proyektor (`/`)**:
  - Tema *kid-friendly* langit cerah dengan awan mengambang dan animasi bintang berkedip.
  - Tampilan podium dinamis: Juara 1 (Emas 🥇), Juara 2 (Perak 🥈), Juara 3 (Perunggu 🥉).
  - Animasi transisi baris dengan `framer-motion` saat ada peserta baru yang finish.
  - Indikator status koneksi dan jam digital pertandingan.
- **Panel Juri & Panitia (`/admin`)**:
  - **Manajemen Peserta (`/admin/peserta`)**: Pendaftaran nama anak, nomor punggung (BIB), dan usia bulan beserta tabel pencarian instan.
  - **Kontrol Lomba (`/admin/kontrol`)**: Stopwatch sesi lomba, tombol besar *Mulai Lomba* & *Akhiri Lomba*, serta grid tombol sentuh per peserta untuk pencatatan waktu finish instan.
  - **Google Sheets Sync (`/admin/sync`)**: Kontrol integrasi remote via Google Sheets.
- **Integrasi Google Sheets Remote Control**:
  - Panitia dapat mengedit data peserta, babak lomba, dan hasil langsung dari Google Sheets. Perubahan otomatis diteruskan ke Supabase secara instan.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14+ (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Animasi**: Framer Motion
- **Database & Realtime**: Supabase (PostgreSQL + PostgREST + Realtime)
- **Icons**: Lucide React
- **Hosting**: Vercel

---

## 📦 Setup & Menjalankan di Lokal (Development)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/<username>/olimpiakids.git
cd olimpiakids
npm install
```

### 2. Konfigurasi Environment Variables
Salin template `.env.example` ke `.env.local`:
```bash
cp .env.example .env.local
```
Isi variabel dengan kredensial Supabase Anda:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
```

### 3. Setup Skema Database di Supabase
1. Buka [Supabase Dashboard](https://supabase.com/dashboard) -> Buka project Anda.
2. Buka menu **SQL Editor**.
3. Buka file `supabase/migrations/001_init.sql`, salin seluruh kodenya lalu klik **Run**.
4. Skrip di atas akan secara otomatis membuat:
   - Tabel `participants`, `race_events`, dan `race_results`.
   - Konfigurasi index & relasi *foreign key cascade*.
   - Aturan keamanan **Row Level Security (RLS)** dengan akses publik.
   - Pendaftaran tabel ke dalam publikasi realtime (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`).

### 4. Jalankan Development Server
```bash
npm run dev
```
Buka browser Anda:
- **Leaderboard Publik**: [http://localhost:3000](http://localhost:3000)
- **Panel Panitia/Admin**: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🌐 Panduan Deployment

### A. Push ke GitHub
Jika belum menghubungkan remote repository:
```bash
# 1. Pastikan Anda sudah membuat repository di GitHub (misal: olimpiakids)
git remote add origin https://github.com/<USERNAME>/olimpiakids.git
git branch -M main
git push -u origin main
```

### B. Deploy ke Vercel
1. Masuk ke [Vercel Dashboard](https://vercel.com/dashboard).
2. Klik tombol **"Add New..."** → **"Project"**.
3. Pilih repository GitHub **`olimpiakids`** dan klik **"Import"**.
4. Di bagian **Environment Variables**, tambahkan:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL Supabase Anda
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Anon Public Key Supabase Anda
5. Klik **"Deploy"**. Vercel akan otomatis melakukan proses build dan memberikan URL preview publik.

---

## 📊 Integrasi Google Sheets (Remote Sync)

Jika Anda ingin mengontrol atau mengedit data lewat spreadsheet Google Sheets:
1. Buat Spreadsheet baru dengan 3 tab:
   - `PESERTA`: Kolom `id`, `name`, `bib_number`, `age_months`
   - `RACE_EVENT`: Kolom `id`, `name`, `status`, `start_time`
   - `HASIL`: Kolom `id`, `participant_id`, `race_event_id`, `duration_ms`, `status`
2. Buka menu **Extensions** → **Apps Script**.
3. Salin isi file `google-apps-script/Code.gs` dan tempel ke editor.
4. Isi `SUPABASE_URL` dan `SUPABASE_SERVICE_KEY` (ambil dari Supabase Dashboard `Settings -> API -> service_role`).
5. Jalankan fungsi `setupTrigger` sekali untuk mengaktifkan sinkronisasi otomatis saat cell diedit.
6. Panduan detail selengkapnya ada di [`google-apps-script/README.md`](google-apps-script/README.md).

---

## 🔒 Catatan Keamanan
File `.env.local` sudah terdaftar di `.gitignore` dan **tidak akan pernah** di-push ke GitHub untuk melindungi kredensial project Anda.
