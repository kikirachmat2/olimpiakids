# Panduan Integrasi Google Sheets ke Supabase (Olimpiakids - Lomba Bayi)

Panduan ini menjelaskan cara menghubungkan Google Sheets sebagai control panel agar setiap perubahan data peserta, sesi lomba, dan catatan hasil otomatis tersinkronisasi ke database Supabase secara realtime.

---

## 1. Persiapan Struktur Spreadsheet di Google Sheets

Buat satu Spreadsheet baru di Google Sheets, kemudian buat **3 tab** dengan nama dan urutan kolom header (baris pertama) persis seperti di bawah ini:

### Tab 1: `PESERTA`
Baris pertama (Header):
| id | name | bib_number | age_months |
|---|---|---|---|
*Contoh isi baris 2:* `1` | `Baby Kenzo` | `01` | `10`  
*(Catatan: Kolom `id` bisa dikosongkan untuk peserta baru, atau diisi angka ID jika ingin mengedit peserta yang sudah ada).*

### Tab 2: `RACE_EVENT`
Baris pertama (Header):
| id | name | status | start_time |
|---|---|---|---|
*Contoh isi baris 2:* `1` | `Heat 1` | `running` | `2026-10-14T15:00:00Z`  
*(Nilai kolom status: `idle`, `running`, atau `finished`).*

### Tab 3: `HASIL`
Baris pertama (Header):
| id | participant_id | race_event_id | duration_ms | status |
|---|---|---|---|---|
*Contoh isi baris 2:* `1` | `1` | `1` | `15420` | `finished`  
*(Catatan: `duration_ms` dalam milidetik, misal 15.42 detik = 15420).*

---

## 2. Pemasangan Script di Google Apps Script

1. Di Google Sheets Anda, klik menu bar atas: **Extensions** -> **Apps Script**.
2. Hapus semua kode default di editor, lalu copy-paste seluruh isi file [`google-apps-script/Code.gs`](file:///Users/kiki/Documents/Web%20Develop/Olimpiakids/google-apps-script/Code.gs) ke editor tersebut.
3. Simpan project script (tekan ikon Disket / `Ctrl + S`).

---

## 3. Pengisian Kredensial Supabase di `Code.gs`

Buka tab browser **Supabase Dashboard**:
1. Pilih project Anda, masuk ke menu **Settings** (ikon gear di kiri bawah) -> **API**.
2. Salin **Project URL** (misal: `https://xyzabc.supabase.co`).
3. Cari bagian **Project API keys**, lalu salin kunci **`service_role` (secret)**.  
   > ⚠️ **PENTING**: Gunakan `service_role` key, **BUKAN** `anon` key, karena Apps Script berjalan di backend cloud Google dan membutuhkan izin untuk melakukan operasi UPSERT. Jangan pernah membagikan kunci ini ke publik.
4. Kembali ke editor Apps Script, ganti baris konfigurasi berikut:
   ```javascript
   var SUPABASE_URL = "https://xyzabc.supabase.co"; // Ganti dengan Project URL Anda
   var SUPABASE_SERVICE_KEY = "eyJh..."; // Ganti dengan service_role key Anda
   ```
5. Simpan kembali (`Ctrl + S`).

---

## 4. Menjalankan Pemasangan Trigger Otomatis (`setupTrigger`)

Agar script berjalan otomatis saat Anda mengedit isi cell di Google Sheets:
1. Di bagian atas editor Apps Script, pada dropdown pilihan fungsi (sebelah tombol *Debug* / *Run*), pilih fungsi **`setupTrigger`**.
2. Klik tombol **Run** (Jalankan).
3. Google akan menampilkan popup perizinan (*Authorization Required*):
   - Klik **Review Permissions**.
   - Pilih akun Google Anda.
   - Klik **Advanced** (Lanjutan) di bagian bawah kiri popup.
   - Klik tautan **Go to Untitled project (unsafe)**.
   - Klik **Allow**.
4. Periksa log eksekusi, jika muncul `🎉 Trigger otomatis 'onEditTrigger' berhasil dipasang!`, berarti trigger telah aktif.

---

## 5. Cara Pengujian & Uji Coba Manual

- **Uji Coba Manual**: Pilih fungsi `syncAllToSupabase` di dropdown editor, lalu klik **Run**. Periksa bagian *Execution log* di bawah editor untuk memastikan status `✅ Berhasil sync tabel ...`.
- **Uji Coba Otomatis**: Coba edit salah satu cell pada tab `PESERTA` di Google Sheets. Dalam beberapa detik, perubahan tersebut otomatis tersimpan di Supabase dan layar leaderboard publik Next.js akan langsung ter-update secara otomatis tanpa refresh!

---

## 6. Catatan Teknis & Batasan (Rate Limit)

- **Arah Sinkronisasi**: Sinkronisasi ini berjalan **Satu Arah (Google Sheets -> Supabase)**.
- **Debounce**: Script sudah dilengkapi pengaman *debounce* 5 detik agar pengetikan berulang di Google Sheets tidak membanjiri kuota API.
- **Quota Google Apps Script**: Google memberikan kuota pemanggilan `UrlFetchApp` sebanyak 20.000 panggilan/hari (akun gratis) dan batas rate limit sekitar 100 request/100 detik, yang sangat aman untuk pemakaian event lomba.
