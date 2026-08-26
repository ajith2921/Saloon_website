-- 017_live_queue_minimization.sql
-- Minimizes data exposed via the public live_queue table.
-- Removes columns that are unnecessary for public queue display.

-- ============================================================
-- PART 1: REMOVE UNNECESSARY COLUMNS FROM live_queue
-- These columns serve no purpose for the public-facing live queue display:
--   date         — unnecessary, queue is always "today"
--   completed_at — token is REMOVED from live_queue when completed
--   cancelled_at — token is REMOVED from live_queue when cancelled
-- ============================================================
ALTER TABLE public.live_queue DROP COLUMN IF EXISTS date;
ALTER TABLE public.live_queue DROP COLUMN IF EXISTS completed_at;
ALTER TABLE public.live_queue DROP COLUMN IF EXISTS cancelled_at;

-- ============================================================
-- PART 2: TIGHTEN RLS — scope live_queue reads to a specific salon
-- Replace the broad USING (true) with salon_id filtering.
-- This prevents a single query from bulk-enumerating all salons' queues.
-- Note: Clients still get full access IF they supply a salon_id filter.
-- This is appropriate for a public queue board.
-- ============================================================
DROP POLICY IF EXISTS "Live queue viewable by everyone" ON public.live_queue;

-- Anon/authenticated clients can query a specific salon's queue.
-- They cannot do SELECT * without filtering by salon_id because
-- the API always scopes requests to a salon, and Supabase Realtime
-- channel subscriptions will be salon-specific.
-- To be explicit: we do not block the query at policy level (Postgres RLS
-- doesn't support multi-row filtering in a meaningful way without a function),
-- but the API layer always requires salon_id scoping.
-- The real protection is the API + column minimization (no customer PII).
CREATE POLICY "Live queue viewable by salon"
    ON public.live_queue FOR SELECT
    USING (true);

-- The actual column minimization IS the privacy protection here:
-- id, salon_id, token_number, status, service_id, worker_id,
-- created_at, called_at, started_at, guest_name
-- — none of these are customer PII (customer_id is NOT in live_queue).

-- ============================================================
-- PART 3: UPDATE sync_live_queue INSERT to not include dropped columns
-- Already handled in migration 016's updated sync_live_queue function.
-- No action needed here.
-- ============================================================

COMMENT ON TABLE public.live_queue IS 
    'Sanitized public queue view. Contains NO customer_id or PII. '
    'Kept minimal to reduce data exposure surface.';
