-- 013_peak_time_analytics.sql
-- Updates get_platform_stats to return peak_times

CREATE OR REPLACE FUNCTION public.get_platform_stats(p_days INT DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_totals JSON;
  v_time_series JSON;
  v_top_salons JSON;
  v_peak_times JSON;
  v_start_date DATE;
BEGIN
  v_start_date := CURRENT_DATE - p_days;

  -- 1. Get Totals
  SELECT json_build_object(
    'total_salons', (SELECT count(*) FROM public.salons),
    'active_salons', (SELECT count(*) FROM public.salons WHERE status = 'active'),
    'pending_approvals', (SELECT count(*) FROM public.salons WHERE status = 'pending'),
    'total_customers', (SELECT count(*) FROM public.profiles WHERE role = 'customer'),
    'total_tokens_today', (SELECT count(*) FROM public.tokens WHERE date = CURRENT_DATE),
    'platform_revenue_month', (
      SELECT COALESCE(SUM(sp.price_monthly), 0)
      FROM public.subscriptions s
      JOIN public.subscription_plans sp ON s.plan_id = sp.id
      WHERE s.current_period_end >= CURRENT_DATE
    )
  ) INTO v_totals;

  -- 2. Generate Time Series (Tokens created per day over last N days)
  WITH date_series AS (
    SELECT generate_series(v_start_date, CURRENT_DATE, '1 day'::interval)::date AS d
  ),
  daily_counts AS (
    SELECT 
      date,
      count(*) as tokens_count
    FROM public.tokens
    WHERE date >= v_start_date
    GROUP BY date
  )
  SELECT json_agg(
    json_build_object(
      'date', to_char(ds.d, 'Mon DD'),
      'tokens', COALESCE(dc.tokens_count, 0)
    ) ORDER BY ds.d
  ) INTO v_time_series
  FROM date_series ds
  LEFT JOIN daily_counts dc ON ds.d = dc.date;

  -- 3. Top Salons by Queue Volume
  WITH salon_counts AS (
    SELECT salon_id, count(*) as total_queue
    FROM public.tokens
    GROUP BY salon_id
    ORDER BY total_queue DESC
    LIMIT 5
  )
  SELECT json_agg(
    json_build_object(
      'name', s.name,
      'queue_volume', sc.total_queue
    )
  ) INTO v_top_salons
  FROM salon_counts sc
  JOIN public.salons s ON s.id = sc.salon_id;

  -- 4. Peak Traffic Hours (Aggregate by Hour of Day)
  WITH hour_counts AS (
    SELECT 
      EXTRACT(HOUR FROM created_at) AS hour_of_day,
      count(*) AS tokens_count
    FROM public.tokens
    WHERE date >= v_start_date
    GROUP BY hour_of_day
    ORDER BY hour_of_day ASC
  )
  SELECT json_agg(
    json_build_object(
      'hour', hour_of_day,
      'count', tokens_count
    )
  ) INTO v_peak_times
  FROM hour_counts;

  RETURN json_build_object(
    'totals', v_totals,
    'time_series', COALESCE(v_time_series, '[]'::json),
    'top_salons', COALESCE(v_top_salons, '[]'::json),
    'peak_times', COALESCE(v_peak_times, '[]'::json)
  );
END;
$$;
