-- Idempotent token refunds for failed visibility probes.
-- The original charge and refund are serialized by locking the user's profile row.
-- Refunds are recorded as negative ledger entries and cannot be applied twice.
CREATE OR REPLACE FUNCTION public.refund_token_charge(
  _user_id uuid,
  _tool_key text,
  _run_id text,
  _reason text DEFAULT 'no_results'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_charge public.token_ledger%ROWTYPE;
  v_refund_id uuid;
  v_daily_used integer;
  v_monthly_used integer;
BEGIN
  IF _user_id IS NULL OR NULLIF(_tool_key, '') IS NULL OR NULLIF(_run_id, '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_refund_reference');
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  END IF;

  SELECT * INTO v_charge
  FROM public.token_ledger
  WHERE user_id = _user_id
    AND tool_key = _tool_key
    AND run_id = _run_id
    AND tokens > 0
    AND COALESCE((meta->>'refund')::boolean, false) = false
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'charge_not_found');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.token_ledger
    WHERE user_id = _user_id
      AND tool_key = _tool_key
      AND run_id = _run_id
      AND meta->>'refund_for' = v_charge.id::text
      AND COALESCE((meta->>'refund')::boolean, false) = true
  ) THEN
    RETURN jsonb_build_object('ok', true, 'refunded', false, 'reason', 'already_refunded',
      'balance', v_profile.tokens_balance,
      'used_today', v_profile.tokens_used_today,
      'used_month', v_profile.tokens_used_month);
  END IF;

  UPDATE public.profiles
  SET tokens_balance = tokens_balance + v_charge.tokens,
      tokens_used_today = CASE
        WHEN usage_day_start IS NOT DISTINCT FROM CURRENT_DATE
          THEN GREATEST(0, tokens_used_today - v_charge.tokens)
        ELSE tokens_used_today
      END,
      tokens_used_month = CASE
        WHEN date_trunc('month', usage_period_start) = date_trunc('month', now())
          THEN GREATEST(0, tokens_used_month - v_charge.tokens)
        ELSE tokens_used_month
      END
  WHERE id = _user_id
  RETURNING * INTO v_profile;

  INSERT INTO public.token_ledger (user_id, tool_key, tokens, usd_cost, run_id, meta)
  VALUES (
    _user_id,
    _tool_key,
    -v_charge.tokens,
    0,
    _run_id,
    jsonb_build_object(
      'refund', true,
      'refund_for', v_charge.id::text,
      'reason', COALESCE(NULLIF(_reason, ''), 'unspecified')
    )
  )
  RETURNING id INTO v_refund_id;

  RETURN jsonb_build_object('ok', true, 'refunded', true, 'refund_id', v_refund_id,
    'charge_id', v_charge.id,
    'tokens', v_charge.tokens,
    'balance', v_profile.tokens_balance,
    'used_today', v_profile.tokens_used_today,
    'used_month', v_profile.tokens_used_month);
END;
$$;

REVOKE ALL ON FUNCTION public.refund_token_charge(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_token_charge(uuid, text, text, text) TO service_role;
