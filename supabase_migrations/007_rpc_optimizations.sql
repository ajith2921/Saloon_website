-- migration: 007_rpc_optimizations.sql

-- 1. Enable Realtime on the tokens table
-- Supabase requires adding the table to the `supabase_realtime` publication
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE tokens;

-- 2. RPC: get_salon_stats
-- Calculates the current day's token statistics and the overall average rating.
CREATE OR REPLACE FUNCTION public.get_salon_stats(p_salon_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today date := current_date;
    v_waiting int := 0;
    v_serving int := 0;
    v_completed int := 0;
    v_total int := 0;
    v_avg_rating numeric := 0.0;
    v_review_count int := 0;
    v_result jsonb;
BEGIN
    -- Aggregate today's tokens
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'waiting'),
        COUNT(*) FILTER (WHERE status IN ('called', 'serving')),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO v_total, v_waiting, v_serving, v_completed
    FROM public.tokens
    WHERE salon_id = p_salon_id AND date = v_today;

    -- Aggregate ratings
    SELECT 
        COUNT(*),
        COALESCE(ROUND(AVG(rating), 1), 0.0)
    INTO v_review_count, v_avg_rating
    FROM public.ratings
    WHERE salon_id = p_salon_id;

    v_result := jsonb_build_object(
        'waiting', v_waiting,
        'serving', v_serving,
        'completed_today', v_completed,
        'total_today', v_total,
        'avg_rating', v_avg_rating,
        'review_count', v_review_count
    );

    RETURN v_result;
END;
$$;


-- 3. RPC: get_salon_customers
-- Returns a distinct list of customers for a salon, ordered by their most recent visit.
CREATE OR REPLACE FUNCTION public.get_salon_customers(p_salon_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_agg(cust)
    INTO v_result
    FROM (
        SELECT DISTINCT ON (t.customer_id)
            t.customer_id as id,
            p.full_name as full_name,
            p.phone as phone,
            p.avatar_url as avatar_url,
            t.date as last_visit,
            t.status as last_token_status
        FROM public.tokens t
        LEFT JOIN public.profiles p ON p.id = t.customer_id
        WHERE t.salon_id = p_salon_id
        ORDER BY t.customer_id, t.created_at DESC
    ) cust;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


-- 4. RPC: get_analytics_summary
-- Calculates the last 7 days of wait times and completions, plus today's totals.
CREATE OR REPLACE FUNCTION public.get_analytics_summary(p_salon_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today date := current_date;
    v_active_barbers int := 0;
    v_chart_data jsonb := '[]'::jsonb;
    v_today_stats jsonb;
    v_result jsonb;
BEGIN
    -- Active Barbers
    SELECT COUNT(*) INTO v_active_barbers
    FROM public.workers
    WHERE salon_id = p_salon_id AND status = 'active';

    -- Chart Data (Last 7 Days)
    SELECT jsonb_agg(day_stat) INTO v_chart_data
    FROM (
        SELECT 
            TO_CHAR(d.day_date, 'Dy') as name,
            COUNT(t.id) as customers,
            COUNT(t.id) FILTER (WHERE t.status = 'completed') as completed,
            -- Rough average wait time using joined service duration
            COALESCE(ROUND(AVG(s.duration_minutes) FILTER (WHERE t.status = 'completed')), 0) as wait_time
        FROM (
            SELECT generate_series(v_today - interval '6 days', v_today, interval '1 day')::date AS day_date
        ) d
        LEFT JOIN public.tokens t ON t.date = d.day_date AND t.salon_id = p_salon_id
        LEFT JOIN public.services s ON s.id = t.service_id
        GROUP BY d.day_date
        ORDER BY d.day_date ASC
    ) day_stat;

    -- Today Stats
    SELECT jsonb_build_object(
        'total_customers_today', customers,
        'completion_rate', CASE WHEN customers > 0 THEN ROUND((completed::numeric / customers::numeric) * 100) ELSE 0 END,
        'avg_wait_time', wait_time
    ) INTO v_today_stats
    FROM (
        SELECT 
            COUNT(t.id) as customers,
            COUNT(t.id) FILTER (WHERE t.status = 'completed') as completed,
            COALESCE(ROUND(AVG(s.duration_minutes) FILTER (WHERE t.status = 'completed')), 0) as wait_time
        FROM public.tokens t
        LEFT JOIN public.services s ON s.id = t.service_id
        WHERE t.salon_id = p_salon_id AND t.date = v_today
    ) ts;

    v_result := jsonb_build_object(
        'chart_data', COALESCE(v_chart_data, '[]'::jsonb),
        'active_barbers', v_active_barbers,
        'total_customers_today', (v_today_stats->>'total_customers_today')::int,
        'completion_rate', (v_today_stats->>'completion_rate')::int,
        'avg_wait_time', (v_today_stats->>'avg_wait_time')::int
    );

    RETURN v_result;
END;
$$;
