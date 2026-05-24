
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  to_number TEXT NOT NULL,
  from_number TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT 'inbound',
  status TEXT NOT NULL DEFAULT 'received',
  telnyx_message_id TEXT,
  media_urls JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_user_created ON public.messages(user_id, created_at DESC);
CREATE INDEX idx_messages_to_number ON public.messages(to_number);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own messages" ON public.messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own messages" ON public.messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER messages_touch_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
