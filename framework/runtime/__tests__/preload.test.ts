import { whenIdle } from '../activity';
import { component } from '../component';
import * as language from '../i18n';

test.each(['en', 'pt-BR'])(
  'preloading a closed dialog prepares its descendants in %s before any render',
  async (locale) => {
    const requested: string[] = [];
    const messages = vi.spyOn(language, 'loadMessages');
    let finish!: () => void;

    const loading = new Promise<void>((resolve) => {
      finish = resolve;
    });

    const folder = (name: string, children: ReturnType<typeof component>[] = [], ready = Promise.resolve()) =>
      component({
        i18n: { default: { title: name } },
        path: `components/preload-${locale}/${name}`,
        skins: {},
        translations: {
          'pt-BR': () => {
            requested.push(`${name}:translation`);

            return Promise.resolve({ default: {} });
          },
        },
        view: () => {
          requested.push(`${name}:view`);

          return ready.then(() => ({
            async: undefined,
            children,
            form: undefined,
            props: undefined,
            render: () => {
              throw new Error('Preloading must not render a folder');
            },
            state: undefined,
          }));
        },
      });

    const Search = folder('search');
    const Commands = folder('commands', [Search], loading);
    const Palette = folder('palette', [Commands]);

    try {
      // The code may start loading before a parent knows which locale is on screen.
      Palette.preload();
      expect(messages).not.toHaveBeenCalled();

      Palette.preload(locale);
      await Promise.resolve();
      finish();
      // Waits for pending loads: no component is mounted to discover the search or its messages.
      await whenIdle();
      expect(requested.filter((request) => request.endsWith(':view'))).toEqual([
        'palette:view',
        'commands:view',
        'search:view',
      ]);
      expect(messages.mock.calls.map(([spec, inLocale]) => [spec.path.split('/').at(-1), inLocale])).toEqual([
        ['palette', locale],
        ['commands', locale],
        ['search', locale],
      ]);
      expect(requested.filter((request) => request.endsWith(':translation'))).toEqual(
        locale === 'pt-BR' ? ['palette:translation', 'commands:translation', 'search:translation'] : [],
      );
    } finally {
      finish();
      messages.mockRestore();
    }
  },
);

test('a failed view preload leaves no unhandled rejection or second load', async () => {
  const view = vi.fn(() => Promise.reject(new Error('The view is unavailable')));

  const Folder = component({ path: 'components/preload-failed', skins: {}, view });

  Folder.preload('en');
  await whenIdle();
  Folder.preload('pt-BR');
  await whenIdle();
  expect(view).toHaveBeenCalledTimes(1);
});

test('a recursive folder import is preloaded only once per traversal', async () => {
  const messages = vi.spyOn(language, 'loadMessages');

  const Folder = component({
    i18n: { default: { title: 'Tree' } },
    path: 'components/preload-recursive',
    skins: {},
    view: () =>
      Promise.resolve({
        async: undefined,
        children: [Folder],
        form: undefined,
        props: undefined,
        render: () => null,
        state: undefined,
      }),
  });

  try {
    Folder.preload('en');
    await whenIdle();
    expect(messages.mock.calls.map(([spec, locale]) => [spec.path, locale])).toEqual([
      ['components/preload-recursive', 'en'],
    ]);
  } finally {
    messages.mockRestore();
  }
});
