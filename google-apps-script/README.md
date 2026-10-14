# Panduan Integrasi Google Sheets & Supabase (Two-Way Sync)

Panduan ini menjelaskan cara mengonfigurasi **Sinkronisasi Dua Arah (Two-Way Sync)** antara Google Sheets dan Supabase:
1. **Google Sheets → Supabase**: Saat Anda mengedit data di spreadsheet, data terupdate otomatis ke Supabase via `onEdit` trigger.
2. **Supabase (Web Admin) → Google Sheets**: Saat juri klik "Finish" atau mengubah status di panel web, Supabase mengirimkan **Database Webhook** ke Apps Script Web App untuk otomatis mengisi baris baru di sheet.

---

## 1. Persiapan Tab di Google Sheets

Buat spreadsheet dengan **3 tab** berikut (pastikan nama header persis):

- **Tab `PESERTA`**: `id` | `name` | `bib_number` | `age_months`
- **Tab `RACE_EVENT`**: `id` | `name` | `status` | `start_time`
- **Tab `HASIL`**: `id` | `participant_id` | `race_event_id` | `duration_ms` | `status`

---

## 2. Deploy Google Apps Script sebagai Web App

Agar Supabase Webhook dapat mengirimkan data ke Google Sheets:
1. Buka spreadsheet Anda → menu **Extensions** → **Apps Script**.
2. Salin seluruh isi file [`google-apps-script/Code.gs`](Code.gs) ke editor.
3. Ganti `SUPABASE_URL` dan `SUPABASE_SERVICE_KEY` dengan kredensial Supabase Anda.
4. Klik tombol biru **Deploy** di kanan atas → **New Deployment**.
5. Klik ikon gear di samping *Select type* → pilih **Web app**.
6. Atur konfigurasi berikut:
   - **Description**: `Supabase Two-Way Sync`
   - **Execute as**: `Me (email anda)`
   - **Who has access**: **`Anyone`** *(Sangat penting: pilih Anyone agar Supabase Webhook diizinkan mengirim request)*
7. Klik **Deploy**, berikan izin perizinan Google (*Review Permissions → Advanced → Go to project (unsafe) → Allow*).
8. Salin **Web app URL** yang dihasilkan (contoh: `https://script.google.com/macros/s/AKfycb.../exec`).

---

## 3. Setup Supabase Database Webhook (Web Admin → Google Sheets)

Fitur Database Webhooks tersedia di Supabase Dashboard:

### Webhook 1: Pencatatan Hasil Finish (`race_results`)
1. Buka **Supabase Dashboard** → Project Anda → menu **Database** (ikon silinder di sidebar kiri).
2. Pilih submenu **Webhooks** → klik **Create a new webhook**.
3. Isi parameter:
   - **Name**: `sync_race_results_to_sheets`
   - **Table**: `race_results`
   - **Events**: Centang **`Insert`** (dan **`Update`** jika perlu)
   - **Type**: `HTTP Request`
   - **Method**: `POST`
   - **URL**: Tempelkan **Web app URL** Google Apps Script dari Langkah 2
   - **HTTP Headers**:
     - `Content-Type`: `application/json`
4. Klik **Create webhook**.

### Webhook 2: Status Sesi Balapan (`race_events`)
1. Di halaman Webhooks, klik **Create a new webhook** lagi:
   - **Name**: `sync_race_events_to_sheets`
   - **Table**: `race_events`
   - **Events**: Centang **`Update`** (dan **`Insert`**)
   - **Method**: `POST`
   - **URL**: Tempelkan **Web app URL** yang sama
   - **HTTP Headers**: `Content-Type`: `application/json`
2. Klik **Create webhook**.

---

## 4. Setup Trigger Sheets → Supabase

1. Kembali ke editor Apps Script, pada dropdown fungsi di bagian atas pilih **`setupTrigger`**.
2. Klik tombol **Run** sekali untuk mengaktifkan trigger otomatis saat Anda mengedit isi spreadsheet.

---

## 5. Pengujian Two-Way Sync

- **Uji Coba Sheets → Web**: Edit nama anak atau nomor BIB di sheet `PESERTA`. Tunggu 3–5 detik, lalu buka web leaderboard atau admin panel — data otomatis terbarui.
- **Uji Coba Web → Sheets**: Buka panel juri `/admin/kontrol`, mulai balapan dan klik finish salah satu peserta. Buka tab `HASIL` di Google Sheets — dalam 1–3 detik baris hasil finish baru akan otomatis bertambah!
