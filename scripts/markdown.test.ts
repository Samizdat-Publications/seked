import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '@seked/data';
import { markdown } from './markdown';

describe('the generated pages\' Markdown', () => {
  it('nests a list by its indentation, and numbers a numbered one', () => {
    expect(markdown('- one\n  - one a\n  - one b\n- two')).toBe(
      '<ul><li>one<ul><li>one a</li><li>one b</li></ul></li><li>two</li></ul>',
    );
    expect(markdown('1. first\n2. second')).toBe('<ol><li>first</li><li>second</li></ol>');
  });

  it('keeps fenced code as it is, escaped and unformatted', () => {
    expect(markdown('```json\n[{"id": "a-1", "note": "**not bold**"}]\n```')).toBe(
      '<pre><code>[{&quot;id&quot;: &quot;a-1&quot;, &quot;note&quot;: &quot;**not bold**&quot;}]</code></pre>',
    );
  });

  it('draws a rule, drops a comment, and still does what it did', () => {
    expect(markdown('one\n\n---\n\ntwo')).toBe('<p>one</p>\n<hr>\n<p>two</p>');
    expect(markdown('<!-- a note\nover two lines -->\n# Title')).toBe('<h1>Title</h1>');
    expect(markdown('A **bold** and *italic* [link](x.html) with `code`.')).toBe(
      '<p>A <strong>bold</strong> and <em>italic</em> <a href="x.html">link</a> with <code>code</code>.</p>',
    );
    expect(markdown('| a | b |\n|---|--:|\n| 1 | 2 |')).toContain('<td class="r">2</td>');
  });

  it('renders every research brief with its sources block as code and no stray list markers', () => {
    for (let n = 1; n <= 8; n++) {
      const html = markdown(readFileSync(join(REPO_ROOT, 'docs', 'research', `ch${n}.md`), 'utf8'));
      expect(html, `ch${n}`).toContain('<pre><code>');
      expect(html, `ch${n}`).not.toMatch(/<p>\s*- /);
    }
  });
});
