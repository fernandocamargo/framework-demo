import { SKINS } from '@/skins';

import { wearSkin } from './handlers';

test.each(SKINS)('a native skin change to %s replaces the address once', (value) => {
  const query = vi.fn();
  // SAFETY: The handler reads only navigation.query and the select's supported value.
  wearSkin({ navigation: { query } } as never)({
    currentTarget: { value },
  } as React.ChangeEvent<HTMLSelectElement>);

  expect(query).toHaveBeenCalledExactlyOnceWith({ skin: value }, { replace: true });
});
