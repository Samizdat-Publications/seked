import { describe, expect, it } from 'vitest';
import { block, inline } from './markdown';

describe("the receipts' Markdown", () => {
  it('escapes before it marks up', () => {
    expect(inline('<b>x</b> **y** `z`')).toBe('&lt;b&gt;x&lt;/b&gt; <strong>y</strong> <code>z</code>');
  });

  it('nests lists by indent', () => {
    expect(block('- a\n  - b\n  - c\n- d')).toBe('<ul><li>a<ul><li>b</li><li>c</li></ul></li><li>d</li></ul>');
  });

  it('draws a table without its rule row', () => {
    expect(block('| x | y |\n|---|---|\n| 1 | 2 |')).toBe(
      '<table><thead><tr><th>x</th><th>y</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
    );
  });
});
