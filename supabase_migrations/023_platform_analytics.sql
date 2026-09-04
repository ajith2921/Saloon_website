-- 023_platform_analytics.sql

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
    'platform_revenue_month', COALESCE((SELECT sum(amount) FROM public.payment_transactions WHERE status = 'captured' AND created_at >= date_trunc('month', CURRENT_DATE)), 0)
  ) INTO v_totals;

  -- 2. Get Time Series (Daily revenue & tokens for last p_days)
  WITH dates AS (
    SELECT generate_series(v_start_date, CURRENT_DATE, '1 day'::interval)::DATE AS d
  ),
  daily_tokens AS (
    SELECT date, count(*) as tokens
    FROM public.tokens
    WHERE date >= v_start_date
    GROUP BY date
  ),
  daily_revenue AS (
    SELECT created_at::DATE as date, sum(amount) as revenue
    FROM public.payment_transactions
    WHERE status = 'captured' AND created_at::DATE >= v_start_date
    GROUP BY created_at::DATE
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'date', to_char(d.d, 'Mon DD'),
      'tokens', COALESCE(t.tokens, 0),
      'revenue', COALESCE(r.revenue, 0)
    ) ORDER BY d.d ASC
  ), '[]'::json) INTO v_time_series
  FROM dates d
  LEFT JOIN daily_tokens t ON d.d = t.date
  LEFT JOIN daily_revenue r ON d.d = r.date;

  -- 3. Get Top Salons (by total tokens ever, plus revenue)
  WITH salon_stats AS (
    SELECT 
      s.id,
      s.name,
      s.city,
      (SELECT count(*) FROM public.tokens WHERE salon_id = s.id) as total_tokens,
      (SELECT COALESCE(sum(amount), 0) FROM public.payment_transactions WHERE salon_id = s.id AND status = 'captured') as revenue
    FROM public.salons s
    WHERE s.status = 'active'
    ORDER BY total_tokens DESC
    LIMIT 5
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', id,
      'name', name,
      'city', city,
      'total_tokens', total_tokens,
      'revenue', revenue
    )
  ), '[]'::json) INTO v_top_salons
  FROM salon_stats;

  -- Return Combined JSON
  RETURN json_build_object(
    'totals', v_totals,
    'time_series', v_time_series,
    'top_salons', v_top_salons
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_stats(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_stats(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_platform_stats(INT) TO authenticated; -- Protected by API require_role("super_admin")
