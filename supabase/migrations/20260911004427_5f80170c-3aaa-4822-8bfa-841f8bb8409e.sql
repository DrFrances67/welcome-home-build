CREATE OR REPLACE FUNCTION public.email_dlq_overview()
RETURNS TABLE(queue_name TEXT, message_count BIGINT, oldest_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  q TEXT;
BEGIN
  FOREACH q IN ARRAY ARRAY['auth_emails_dlq', 'transactional_emails_dlq'] LOOP
    BEGIN
      RETURN QUERY EXECUTE format(
        'SELECT %L::text, count(*)::bigint, min(enqueued_at)::timestamptz FROM pgmq.q_%I', q, q
      );
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT q, 0::bigint, NULL::timestamptz;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.email_dlq_messages(_queue TEXT, _limit INT DEFAULT 50)
RETURNS TABLE(msg_id BIGINT, enqueued_at TIMESTAMPTZ, read_ct INT, message JSONB)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  IF _queue NOT IN ('auth_emails_dlq', 'transactional_emails_dlq') THEN
    RAISE EXCEPTION 'unknown queue %', _queue;
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT msg_id::bigint, enqueued_at::timestamptz, read_ct::int, message::jsonb FROM pgmq.q_%I ORDER BY enqueued_at DESC LIMIT %s',
    _queue, greatest(1, least(coalesce(_limit, 50), 200))
  );
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.email_dlq_requeue(_queue TEXT, _msg_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  target TEXT;
  payload JSONB;
BEGIN
  IF _queue NOT IN ('auth_emails_dlq', 'transactional_emails_dlq') THEN
    RAISE EXCEPTION 'unknown queue %', _queue;
  END IF;
  target := replace(_queue, '_dlq', '');
  EXECUTE format('SELECT message::jsonb FROM pgmq.q_%I WHERE msg_id = $1', _queue)
    INTO payload USING _msg_id;
  IF payload IS NULL THEN
    RETURN FALSE;
  END IF;
  PERFORM pgmq.send(target, payload);
  PERFORM pgmq.delete(_queue, _msg_id);
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.email_dlq_discard(_queue TEXT, _msg_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  IF _queue NOT IN ('auth_emails_dlq', 'transactional_emails_dlq') THEN
    RAISE EXCEPTION 'unknown queue %', _queue;
  END IF;
  PERFORM pgmq.delete(_queue, _msg_id);
  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.email_dlq_overview() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_dlq_messages(TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_dlq_requeue(TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_dlq_discard(TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_dlq_overview() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_dlq_messages(TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_dlq_requeue(TEXT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_dlq_discard(TEXT, BIGINT) TO service_role;