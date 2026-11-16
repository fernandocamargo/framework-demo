import { activateSkin, preloadSkin, registerSkins } from '../style';

test('loading another folder does not make Root wait for the skin already on screen', async () => {
  activateSkin('default');
  const ready = preloadSkin('default');
  await ready;
  registerSkins('components/late', { default: () => Promise.resolve({ default: '' }) });
  expect(preloadSkin('default')).toBe(ready);
});

test('a skin prepared before a folder loads includes that folder when it is next selected', async () => {
  const load = vi.fn(() => Promise.resolve({ default: '' }));
  await preloadSkin('blueprint');
  registerSkins('components/later', { blueprint: load });
  await preloadSkin('blueprint');
  expect(load).toHaveBeenCalledOnce();
});
