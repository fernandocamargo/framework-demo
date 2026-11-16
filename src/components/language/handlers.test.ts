import { speakLanguage } from './handlers';

test.each(['en', 'pt-BR'])('a native language change to %s updates the address once', (value) => {
  window.history.replaceState(null, '', '/?world=memory&skin=blueprint#/products?q=lamp');
  const changed = vi.fn();
  window.addEventListener('localechange', changed);

  try {
    // SAFETY: The handler reads only the select's current value.
    speakLanguage()({ currentTarget: { value } } as React.ChangeEvent<HTMLSelectElement>);

    expect(window.location.search).toBe(`?world=memory&skin=blueprint&lang=${value}`);
    expect(window.location.hash).toBe('#/products?q=lamp');
    expect(changed).toHaveBeenCalledTimes(1);
  } finally {
    window.removeEventListener('localechange', changed);
  }
});
