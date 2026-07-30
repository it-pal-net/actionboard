/**
 * ActionBoard-owned helpers for card embeds — elements that ARE a tracker
 * card (Trello/Jira/…) placed on the canvas. Hosts store a card payload in
 * `customData.card` (legacy scenes: `customData.trelloCard`) and keep the
 * card's URL in `link` because embed validation requires it — but the stock
 * link UI (canvas icon, hover hit target, click-through) must not render for
 * these elements: the embed itself is the card.
 *
 * Upstream call sites hooking into this module are listed in the divergence
 * log (ACTIONBOARD.md).
 */
export const hasCardPayload = (
  element:
    | { customData?: Readonly<Record<string, unknown>> | null }
    | null
    | undefined,
): boolean =>
  Boolean(element?.customData?.card || element?.customData?.trelloCard);
