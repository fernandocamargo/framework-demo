import { fireEvent, render } from '@testing-library/react';

import { fill as fillAccount } from './handlers';
import view from './render';

test('a native demo button fills once without submitting and keeps its node with the latest account', () => {
  const fill = vi.fn();
  const submitted = vi.fn((event: React.FormEvent) => event.preventDefault());

  const page = (account: { label: string; username: string }) => {
    // SAFETY: This handler reads only the account and the parent's fill callback.
    const handlers = { fill: fillAccount({ account, fill } as never) };

    return (
      <form onSubmit={submitted}>
        <menu>{view({ account, className: '', handlers })}</menu>
      </form>
    );
  };

  const shown = render(page({ label: 'Emily, admin', username: 'emilys' }));
  const button = shown.getByRole('button', { name: 'Emily, admin' });

  try {
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.hasAttribute('data-rac')).toBe(false);
    button.focus();
    fireEvent.click(button);
    expect(fill.mock.calls).toEqual([['emilys']]);
    expect(submitted).not.toHaveBeenCalled();

    shown.rerender(page({ label: 'Olivia, moderator', username: 'oliviaw' }));
    expect(shown.getByRole('button', { name: 'Olivia, moderator' })).toBe(button);
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(fill.mock.calls).toEqual([['emilys'], ['oliviaw']]);
    expect(submitted).not.toHaveBeenCalled();
  } finally {
    shown.unmount();
  }
});
