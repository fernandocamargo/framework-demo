import { execute } from '../async';

test('an export that throws before it returns a promise fails as a rejection', async () => {
  const thrown = new Error('before the promise');
  let promise: Promise<unknown> | undefined;
  expect(() => {
    promise = execute(
      () => {
        throw thrown;
      },
      {},
      [],
    );
  }).not.toThrow();
  await expect(promise).rejects.toBe(thrown);
});
