/**
 * Small round badge for a Today's Schedule row whose customer has actually
 * checked in (a real `arrival_at`, never inferred from time or guesswork) and
 * whose work order isn't closed yet. Sits in the card's existing right-side
 * slot — see the heading row in TvShopScreen — without resizing the card.
 */
export function TvInShopBadge() {
  return (
    <span className="tv-in-shop-badge" title="Checked in and in the shop">
      <span className="tv-in-shop-badge-ring" aria-hidden="true" />
      IN
      <br />
      SHOP
    </span>
  );
}
