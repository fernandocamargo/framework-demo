import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { examples } from './props';

afterEach(cleanup);

for (const [name, example] of Object.entries(examples)) {
  it(`${name} has a native heading and an explicitly named dialog`, () => {
    render(example.props.children);
    const heading = screen.getByRole('heading', { level: 2 });
    const dialog = screen.getByRole(name === 'A question' ? 'alertdialog' : 'dialog', { name: heading.textContent! });

    expect(dialog.getAttribute('aria-label')).toBe(heading.textContent);
    expect(dialog.getAttribute('aria-labelledby')).toBeNull();
    expect(heading.hasAttribute('slot')).toBe(false);
  });
}
