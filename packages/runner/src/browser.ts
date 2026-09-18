/**
 * The browser entry: everything the viewer needs to put prose to the model
 * with the reader's own key, and nothing that reads a file. The context is
 * built from the bundle the viewer already loaded, the claim comes back
 * through the same schema the filed claims use, and the same evaluator grades
 * it. Loading `data/` and writing `build/claims/` is `./index`, which stays
 * behind in Node.
 */
export * from './claim-file';
export * from './context';
export * from './propose';
