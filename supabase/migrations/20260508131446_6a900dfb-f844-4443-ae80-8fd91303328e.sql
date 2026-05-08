-- Publishing channels per user (Telegram now, LinkedIn/Facebook later)
CREATE TABLE IF NOT EXISTS public.publish_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL, -- 'telegram' | 'linkedin' | 'facebook' | 'instagram'
  label TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- { bot_token, chat_id } for telegram
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.publish_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own channels" ON public.publish_channels
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins view all channels" ON public.publish_channels
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Track publish history
CREATE TABLE IF NOT EXISTS public.publish_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_id UUID,
  channel_id UUID,
  kind TEXT NOT NULL,
  status TEXT NOT NULL, -- 'sent' | 'failed'
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.publish_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own publish log" ON public.publish_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admins view all publish log" ON public.publish_log
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Brand for visibility check (one row per user)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS brand_keywords TEXT;