import { SKINS } from '@/skins';

import { wearSkin } from './handlers';

test.each(SKINS)('a native skin change to %s replaces the address once', (value) => {
  window.history.replaceState({ visit: 1 }, '', '/?world=memory&lang=pt-BR&skin=blueprint#/products?q=lamp');
  const changed = vi.fn();
  window.addEventListener('skinchange', changed);

  try {
    // SAFETY: The handler reads only the select's current value.
    wearSkin()({ currentTarget: { value } } as React.ChangeEvent<HTMLSelectElement>);

    const url = new URL(window.location.href);
    expect(url.searchParams.get('skin')).toBe(value === 'default' ? null : value);
    expect(url.searchParams.get('world')).toBe('memory');
    expect(url.searchParams.get('lang')).toBe('pt-BR');
    expect(url.hash).toBe('#/products?q=lamp');
    expect(window.history.state).toEqual({ visit: 1 });
    expect(changed).toHaveBeenCalledTimes(1);
  } finally {
    window.removeEventListener('skinchange', changed);
  }
});
