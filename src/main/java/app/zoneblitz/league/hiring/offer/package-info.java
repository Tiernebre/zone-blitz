/**
 * Feature-internal offer flow for {@link app.zoneblitz.league.hiring}. Holds the {@code MakeOffer},
 * {@code MatchCounterOffer}, and {@code DeclineCounterOffer} use-case implementations; the {@code
 * OfferResolver} seam and its {@code PreferenceScoringOfferResolver} implementation; {@code
 * OfferScoring}, {@code StanceEvaluator}, {@code OfferTermsJson}; and the {@code
 * CandidateOfferRepository} + jOOQ adapter.
 *
 * <p>See the hiring feature's {@code README.md} in the parent directory for the full layout.
 */
package app.zoneblitz.league.hiring.offer;
