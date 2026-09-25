-- TV Mode screen rotation duration, per shop. Null means "use the default".
ALTER TABLE public.shop_settings ADD COLUMN IF NOT EXISTS tv_rotation_seconds integer;
