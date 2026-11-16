// The filter bar's commands: typing keeps the text in the form, and a search, a clear or a pick
// writes the address, back to its first page.
import { sorting } from './props';

export const setSearch =
  ({ form }) =>
  (typed: string) =>
    form.set('q', typed);

export const clearSearch =
  ({ navigation }) =>
  () =>
    navigation.go({ page: 1, q: '' });

export const search =
  ({ navigation }) =>
  (typed: string) =>
    navigation.go({ page: 1, q: typed.trim() });

export const pickCategory =
  ({ navigation }) =>
  (key: null | React.Key) =>
    navigation.go({ category: key === 'all' ? '' : String(key), page: 1 });

export const pickSort =
  ({ navigation }) =>
  (event: React.ChangeEvent<HTMLSelectElement>) =>
    navigation.go({ ...sorting(event.currentTarget.value), page: 1 });
