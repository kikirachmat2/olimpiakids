-- =========================================================
-- MIGRATION: 003_sheet_sync.sql
-- Sinkronisasi Google Sheets -> Leaderboard secara ATOMIK
-- =========================================================
-- Masalah yang diperbaiki:
--  1. Sync lama: DELETE semua hasil lalu INSERT ulang -> web sempat membaca
--     leaderboard KOSONG (flicker) & semua baris animasi ulang.
--  2. Edit beruntun memicu beberapa sync bersamaan -> balapan data / duplikat.
--  3. Urutan peserta dengan timer sama (seri) tidak stabil -> sekarang ikut
--     urutan baris di Sheet lewat kolom `position`.
--  4. Sequence ID tidak sinkron karena insert dengan id manual.
-- =========================================================

-- 1. Kolom posisi (urutan baris di Sheet) untuk ranking yang identik dengan Sheet
ALTER TABLE race_results ADD COLUMN IF NOT EXISTS position INTEGER;
CREATE INDEX IF NOT EXISTS idx_race_results_event_position ON race_results(race_event_id, position);

-- 2. Samakan sequence ID dengan data yang ada (mencegah error duplicate key)
SELECT setval(pg_get_serial_sequence('participants', 'id'), COALESCE((SELECT MAX(id) FROM participants), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('race_events', 'id'), COALESCE((SELECT MAX(id) FROM race_events), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('race_results', 'id'), COALESCE((SELECT MAX(id) FROM race_results), 0) + 1, false);

-- 3. Realtime juga untuk participants (perubahan nama langsung tampil)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE participants;
  END IF;
END $$;

-- 4. Fungsi sync atomik: satu panggilan = satu transaksi
CREATE OR REPLACE FUNCTION public.sync_leaderboard_from_sheet(
  p_rows jsonb,
  p_event_id bigint DEFAULT 1,
  p_event_name text DEFAULT 'LEADERBOARD BABY CRAWLING'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_received int;
  v_valid int;
  v_inserted int := 0;
  v_updated int := 0;
  v_deleted int := 0;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows harus berupa JSON array';
  END IF;

  -- Kunci per event: sync yang datang bersamaan dijalankan bergantian, tidak bertabrakan
  PERFORM pg_advisory_xact_lock(hashtext('sync_leaderboard_from_sheet'), p_event_id::int);

  v_received := jsonb_array_length(p_rows);

  -- Pastikan event ada & berstatus running (start_time lama dipertahankan)
  INSERT INTO race_events (id, name, status, start_time)
  VALUES (p_event_id, p_event_name, 'running', NOW())
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name, status = 'running'
    WHERE race_events.name IS DISTINCT FROM EXCLUDED.name
       OR race_events.status IS DISTINCT FROM 'running';

  -- Normalisasi baris Sheet: trim, nomor dada uppercase, buang baris kosong,
  -- buang nomor dada duplikat (ambil kemunculan pertama), posisi = urutan baris
  DROP TABLE IF EXISTS _sheet_rows;
  CREATE TEMP TABLE _sheet_rows ON COMMIT DROP AS
  WITH raw AS (
    SELECT
      upper(btrim(coalesce(r->>'bib', ''))) AS bib,
      btrim(regexp_replace(coalesce(r->>'name', ''), '\s+', ' ', 'g')) AS name,
      CASE WHEN (r->>'duration_ms') ~ '^\d{1,9}$' THEN (r->>'duration_ms')::int END AS duration_ms,
      ord
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, ord)
  ),
  dedup AS (
    SELECT DISTINCT ON (bib) bib, name, duration_ms, ord
    FROM raw
    WHERE bib <> '' AND name <> ''
    ORDER BY bib, ord
  )
  SELECT bib, name, duration_ms, (row_number() OVER (ORDER BY ord))::int AS position
  FROM dedup;

  SELECT count(*) INTO v_valid FROM _sheet_rows;

  -- Peserta: cocokkan berdasarkan NOMOR DADA, update nama hanya jika berubah
  INSERT INTO participants (name, bib_number)
  SELECT name, bib FROM _sheet_rows
  ON CONFLICT (bib_number) DO UPDATE
    SET name = EXCLUDED.name
    WHERE participants.name IS DISTINCT FROM EXCLUDED.name;

  -- Hapus HANYA peserta yang sudah tidak ada di Sheet
  WITH del AS (
    DELETE FROM race_results rr
    WHERE rr.race_event_id = p_event_id
      AND NOT EXISTS (
        SELECT 1 FROM _sheet_rows s
        JOIN participants p ON p.bib_number = s.bib
        WHERE p.id = rr.participant_id
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM del;

  -- Insert/update hasil; baris yang tidak berubah tidak disentuh (tidak memicu realtime)
  WITH up AS (
    INSERT INTO race_results (participant_id, race_event_id, duration_ms, position, status, finish_time)
    SELECT p.id, p_event_id, s.duration_ms, s.position, 'finished', NOW()
    FROM _sheet_rows s
    JOIN participants p ON p.bib_number = s.bib
    ON CONFLICT (participant_id, race_event_id) DO UPDATE
      SET duration_ms = EXCLUDED.duration_ms,
          position = EXCLUDED.position,
          status = 'finished'
      WHERE race_results.duration_ms IS DISTINCT FROM EXCLUDED.duration_ms
         OR race_results.position IS DISTINCT FROM EXCLUDED.position
         OR race_results.status IS DISTINCT FROM 'finished'
    RETURNING (xmax = 0) AS is_insert
  )
  SELECT count(*) FILTER (WHERE is_insert), count(*) FILTER (WHERE NOT is_insert)
  INTO v_inserted, v_updated
  FROM up;

  RETURN jsonb_build_object(
    'ok', true,
    'event_id', p_event_id,
    'received', v_received,
    'synced', v_valid,
    'skipped', v_received - v_valid,
    'inserted', v_inserted,
    'updated', v_updated,
    'deleted', v_deleted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_leaderboard_from_sheet(jsonb, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_leaderboard_from_sheet(jsonb, bigint, text) TO anon, authenticated, service_role;

-- Muat ulang schema cache PostgREST agar RPC langsung bisa dipanggil
NOTIFY pgrst, 'reload schema';
