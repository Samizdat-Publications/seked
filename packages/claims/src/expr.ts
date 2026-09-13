/**
 * A small, safe expression language for claim formulas. No eval.
 *
 *   g1.base.perimeter / g1.height.original
 *   atan(7 / 5.5)
 *   sqrt((kc.width / cubit.royal)^2 + (kc.height / cubit.royal)^2)
 *
 * Operators + - * / ^ with the usual precedence (^ binds tightest and is
 * right-associative; unary minus sits between ^ and * /). Identifiers are
 * dotted names resolved against the environment. Trigonometry works in
 * degrees, matching the database.
 */
export type Env = Record<string, number>;

type Token =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '^' }
  | { t: '(' } | { t: ')' } | { t: ',' } | { t: 'end' };

const DEG = Math.PI / 180;

export const CONSTANTS: Readonly<Env> = Object.freeze({
  pi: Math.PI,
  tau: 2 * Math.PI,
  phi: (1 + Math.sqrt(5)) / 2,
  e: Math.E,
  sqrt2: Math.SQRT2,
  sqrt3: Math.sqrt(3),
});

const FUNCTIONS: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log10: Math.log10,
  exp: Math.exp,
  floor: Math.floor,
  round: Math.round,
  min: Math.min,
  max: Math.max,
  sin: (x) => Math.sin(x * DEG),
  cos: (x) => Math.cos(x * DEG),
  tan: (x) => Math.tan(x * DEG),
  asin: (x) => Math.asin(x) / DEG,
  acos: (x) => Math.acos(x) / DEG,
  atan: (x) => Math.atan(x) / DEG,
  atan2: (y, x) => Math.atan2(y, x) / DEG,
  hypot: Math.hypot,
};

const ARITY: Record<string, number | null> = { atan2: 2, min: null, max: null, hypot: null };

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i] as string;
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new SyntaxError(`bad number at ${i} in "${src}"`);
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*/.exec(src.slice(i)) as RegExpExecArray;
      out.push({ t: 'id', v: m[0] });
      i += m[0].length;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') { out.push({ t: 'op', v: ch }); i++; continue; }
    if (ch === '(') { out.push({ t: '(' }); i++; continue; }
    if (ch === ')') { out.push({ t: ')' }); i++; continue; }
    if (ch === ',') { out.push({ t: ',' }); i++; continue; }
    throw new SyntaxError(`unexpected "${ch}" at ${i} in "${src}"`);
  }
  out.push({ t: 'end' });
  return out;
}

export type Node =
  | { k: 'num'; v: number }
  | { k: 'id'; v: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { k: 'call'; fn: string; args: Node[] };

export function parse(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p] as Token;
  const next = () => toks[p++] as Token;
  const expect = (t: Token['t']) => {
    const tok = next();
    if (tok.t !== t) throw new SyntaxError(`expected ${t} but found ${tok.t} in "${src}"`);
  };

  function expr(): Node {
    let a = term();
    for (;;) {
      const t = peek();
      if (t.t === 'op' && (t.v === '+' || t.v === '-')) { next(); a = { k: 'bin', op: t.v, a, b: term() }; }
      else return a;
    }
  }
  function term(): Node {
    let a = unary();
    for (;;) {
      const t = peek();
      if (t.t === 'op' && (t.v === '*' || t.v === '/')) { next(); a = { k: 'bin', op: t.v, a, b: unary() }; }
      else return a;
    }
  }
  function unary(): Node {
    const t = peek();
    if (t.t === 'op' && t.v === '-') { next(); return { k: 'neg', a: unary() }; }
    if (t.t === 'op' && t.v === '+') { next(); return unary(); }
    return power();
  }
  function power(): Node {
    const a = atom();
    const t = peek();
    if (t.t === 'op' && t.v === '^') { next(); return { k: 'bin', op: '^', a, b: unary() }; }
    return a;
  }
  function atom(): Node {
    const t = next();
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === '(') { const e = expr(); expect(')'); return e; }
    if (t.t === 'id') {
      if (peek().t === '(') {
        next();
        const args: Node[] = [];
        if (peek().t !== ')') {
          args.push(expr());
          while (peek().t === ',') { next(); args.push(expr()); }
        }
        expect(')');
        return { k: 'call', fn: t.v, args };
      }
      return { k: 'id', v: t.v };
    }
    throw new SyntaxError(`unexpected ${t.t} in "${src}"`);
  }

  const root = expr();
  expect('end');
  return root;
}

export function evaluateNode(n: Node, env: Env): number {
  switch (n.k) {
    case 'num': return n.v;
    case 'id': {
      const v = env[n.v] ?? CONSTANTS[n.v];
      if (v === undefined) throw new ReferenceError(`unknown identifier "${n.v}"`);
      return v;
    }
    case 'neg': return -evaluateNode(n.a, env);
    case 'bin': {
      const a = evaluateNode(n.a, env), b = evaluateNode(n.b, env);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '^': return a ** b;
      }
      break;
    }
    case 'call': {
      const fn = FUNCTIONS[n.fn];
      if (!fn) throw new ReferenceError(`unknown function "${n.fn}"`);
      const arity = n.fn in ARITY ? ARITY[n.fn] : 1;
      if (arity !== null && n.args.length !== arity) throw new SyntaxError(`${n.fn} takes ${arity} argument(s)`);
      return fn(...n.args.map((a) => evaluateNode(a, env)));
    }
  }
  throw new Error('unreachable');
}

export function evaluate(src: string, env: Env = {}): number {
  return evaluateNode(parse(src), env);
}

/** Every identifier a formula reads from the environment (constants excluded). */
export function identifiers(src: string): string[] {
  const out = new Set<string>();
  const walk = (n: Node): void => {
    if (n.k === 'id') { if (!(n.v in CONSTANTS)) out.add(n.v); }
    else if (n.k === 'neg') walk(n.a);
    else if (n.k === 'bin') { walk(n.a); walk(n.b); }
    else if (n.k === 'call') n.args.forEach(walk);
  };
  walk(parse(src));
  return [...out].sort();
}
