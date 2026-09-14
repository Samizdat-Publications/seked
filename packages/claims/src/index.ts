// evaluate.ts reaches the sky through @seked/sky/browser, which reads no
// files. Importing the package here registers data/stars/named.json as the
// default catalogue, so the Node tools keep evaluating sky claims unasked.
import '@seked/sky';

export * from './expr';
export * from './registry';
export * from './evaluate';
export * from './dossier';
