
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS polar_customer_id text,
  ADD COLUMN IF NOT EXISTS auto_topup_subscription_id text,
  ADD COLUMN IF NOT EXISTS auto_topup_product_id text,
  ADD COLUMN IF NOT EXISTS auto_topup_active boolean NOT NULL DEFAULT false;

ALTER TABLE public.credit_purchases
  ADD COLUMN IF NOT EXISTS polar_checkout_id text,
  ADD COLUMN IF NOT EXISTS polar_order_id text,
  ADD COLUMN IF NOT EXISTS polar_subscription_id text,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'topup';

CREATE UNIQUE INDEX IF NOT EXISTS credit_purchases_polar_order_id_uidx
  ON public.credit_purchases (polar_order_id)
  WHERE polar_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS credit_purchases_polar_checkout_id_idx
  ON public.credit_purchases (polar_checkout_id);
