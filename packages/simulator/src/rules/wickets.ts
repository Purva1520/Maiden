/**
 * Wicket model (§31/§97). v1 simplification: a WICKET dismisses the striker and
 * is always credited to the bowler. The WicketResult shape (in models/delivery)
 * is structured so more dismissal kinds can be added later without rewrites.
 */
export const V1_WICKET_MODEL = 'striker-out-bowler-credited' as const;
