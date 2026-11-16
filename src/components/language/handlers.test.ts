import { speakLanguage } from './handlers';

test.each(['en', 'pt-BR'])('a native language change to %s updates the address once', (value) => {
  const query = vi.fn();
  // SAFETY: The handler reads only navigation.query and the select's supported value.
  speakLanguage({ navigation: { query } } as never)({
    currentTarget: { value },
  } as React.ChangeEvent<HTMLSelectElement>);

  expect(query).toHaveBeenCalledExactlyOnceWith({ lang: value }, { replace: true });
});
