-- =========================================================
-- MIGRATION: 004_match_session.sql
-- Penanganan DNF & Master Sync dari LIVE VISUAL
-- =========================================================

CREATE OR REPLACE FUNCTION public.sync_leaderboard_from_sheet(
  p_rows jsonb,
  p_event_id bigint DEFAULT 2,
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

  PERFORM pg_advisory_xact_lock(hashtext('sync_leaderboard_from_sheet'), p_event_id::int);

  v_received := jsonb_array_length(p_rows);

  -- Pastikan event aktif
  INSERT INTO race_events (id, name, status, start_time)
  VALUES (p_event_id, p_event_name, 'running', NOW())
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name, status = 'running';

  -- Normalisasi baris
  DROP TABLE IF EXISTS _sheet_rows;
  CREATE TEMP TABLE _sheet_rows ON COMMIT DROP AS
  WITH raw AS (
    SELECT
      upper(btrim(coalesce(r->>'bib', ''))) AS bib,
      btrim(regexp_replace(coalesce(r->>'name', ''), '\s+', ' ', 'g')) AS name,
      CASE WHEN (r->>'duration_ms') ~ '^\d{1,9}$' THEN (r->>'duration_ms')::int END AS duration_ms,
      CASE 
        WHEN lower(coalesce(r->>'status', '')) IN ('disqualified', 'dnf') THEN 'disqualified'
        ELSE 'finished'
      END AS status,
      ord
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, ord)
  ),
  dedup AS (
    SELECT DISTINCT ON (bib) bib, name, duration_ms, status, ord
    FROM raw
    WHERE bib <> '' AND name <> ''
    ORDER BY bib, ord
  )
  SELECT 
    bib, 
    name, 
    CASE WHEN status = 'disqualified' THEN NULL ELSE duration_ms END AS duration_ms, 
    status,
    CASE WHEN status = 'disqualified' THEN 9999 ELSE (row_number() OVER (ORDER BY ord))::int END AS position
  FROM dedup;

  SELECT count(*) INTO v_valid FROM _sheet_rows;

  IF v_valid = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Tidak ada data peserta valid yang terbaca dari Sheet',
      'received', v_received,
      'synced', 0
    );
  END IF;

  -- Upsert participants
  INSERT INTO participants (name, bib_number)
  SELECT name, bib FROM _sheet_rows
  ON CONFLICT (bib_number) DO UPDATE
    SET name = EXCLUDED.name
    WHERE participants.name IS DISTINCT FROM EXCLUDED.name;

  -- Hapus peserta yang sudah tidak ada di Sheet
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

  -- Upsert race_results dengan penanganan status DNF dan durasi
  WITH up AS (
    INSERT INTO race_results (participant_id, race_event_id, duration_ms, position, status, finish_time)
    SELECT p.id, p_event_id, s.duration_ms, s.position, s.status, NOW()
    FROM _sheet_rows s
    JOIN participants p ON p.bib_number = s.bib
    ON CONFLICT (participant_id, race_event_id) DO UPDATE
      SET duration_ms = EXCLUDED.duration_ms,
          position = EXCLUDED.position,
          status = EXCLUDED.status,
          finish_time = NOW()
      WHERE race_results.duration_ms IS DISTINCT FROM EXCLUDED.duration_ms
         OR race_results.position IS DISTINCT FROM EXCLUDED.position
         OR race_results.status IS DISTINCT FROM EXCLUDED.status
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
    'inserted', v_inserted,
    'updated', v_updated,
    'deleted', v_deleted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_leaderboard_from_sheet(jsonb, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_leaderboard_from_sheet(jsonb, bigint, text) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';

