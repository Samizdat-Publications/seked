/**
 * The browser entry: the expression language, the claim schema, the evaluator
 * and the dossier's formatters, with no node:fs in the import graph. Loading
 * the YAML files is `./registry`, which stays behind in Node; a viewer is
 * handed the normalised claims and evaluates them itself.
 */
export * from './expr';
export * from './schema';
export * from './evaluate';
export * from './dossier';
