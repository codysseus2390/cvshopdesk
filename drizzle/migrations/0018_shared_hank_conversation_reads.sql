-- Everyone approved at the shop can read the shop's Hank conversation.
CREATE POLICY "shop assistant messages read"
  ON public.assistant_messages
  FOR SELECT
  TO authenticated
  USING (public.has_shop_access(shop_id));