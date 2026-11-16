import { intlOf, messagesOf } from 'framework/testing';

import * as messages from './i18n';
import portuguese from './i18n/pt-BR.json';
import rowProps, { examples } from './props';

test.each([
  ['en', 'Stock of Arc Floor Lamp'],
  ['pt-BR', 'Estoque de Arc Floor Lamp'],
])('the stock group keeps its %s name, pending state and current actions', (locale, name) => {
  const setStock = vi.fn();
  const fixture = examples['In stock'].props;

  const i18n = messagesOf(
    messages,
    locale,
    locale === 'en' ? {} : portuguese,
    'components/app/routes/products/components/catalogue/components/product-row',
  );

  const row = (stock: number, pending = false) =>
    // SAFETY: The fixture supplies every field the row's shaper reads.
    rowProps({
      ...fixture,
      acl: { allowed: true, role: 'admin' },
      async: { setStock },
      flags: { stockCount: true },
      i18n,
      intl: intlOf(locale),
      product: { ...fixture.product, stock },
      status: { setStock: { pending } },
    } as never);

  const before = row(58);
  expect(before.stepper?.label).toBe(name);
  expect(before.viewHref).toBe('/products/22');
  expect(before.editHref).toBe('/products/22/edit');
  before.stepper?.more.press();
  expect(setStock).toHaveBeenLastCalledWith(22, 59);

  const pending = row(59, true);
  expect(pending.stepper?.sending).toBe(true);
  pending.stepper?.less.press();
  expect(setStock).toHaveBeenLastCalledWith(22, 58);
  expect(row(0).stepper?.less.disabled).toBe(true);
  expect(row(58).stepper?.sending).toBe(false);
});
