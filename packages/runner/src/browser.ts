/**
 * The browser entry: everything the viewer needs to put prose to the model
 * with the reader's own key, and nothing that reads a file. The context is
 * built from the bundle the viewer already loaded, the claim comes back
 * through the same schema the filed claims use, and the same evaluator grades
 * it. Loading `data/` and writing `build/claims/` is `./index`, which stays
 * behind in Node.
 */
import type { Claim } from '@seked/claims/browser';

/**
 * Prose in, a graded claim out. The stub throws until track T lands; the
 * signature is here so the drawer and the CLI can be written against it.
 */
export function proposeClaim(_prose: string): Promise<{ claim: Claim }> {
  return Promise.reject(new Error('the claims runner is not here yet'));
}
