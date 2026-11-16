// The filter bar's commands: typing keeps the text in the form, and a search, a clear or a pick
// writes the address, back to its first page.
import { sorting } from './props';

export const setSearch =
  ({ form }) =>
  (event: React.ChangeEvent<HTMLInputElement>) =>
    form.set('q', event.currentTarget.value);

export const clearSearch =
  ({ form, navigation }) =>
  (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.set('q', '');
    navigation.query('/products', { page: 1, q: '' });
    event.currentTarget.querySelector('input')?.focus();
  };

export const keepSearchFocus = () => (event: React.PointerEvent<HTMLButtonElement>) => {
  // Clearing on touch keeps the field's keyboard open.
  event.preventDefault();
  event.currentTarget.form?.querySelector('input')?.focus();
};

export const searchKey =
  ({ form, navigation }) =>
  (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape' || !event.currentTarget.value) return;
    event.preventDefault();
    event.stopPropagation();
    form.set('q', '');
    navigation.query('/products', { page: 1, q: '' });
  };

export const search =
  ({ form, navigation }) =>
  (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigation.query('/products', { page: 1, q: form.values.q.trim() });
  };

export const pickCategory =
  ({ navigation }) =>
  (event: React.ChangeEvent<HTMLSelectElement>) =>
    navigation.query('/products', {
      category: event.currentTarget.value === 'all' ? '' : event.currentTarget.value,
      page: 1,
    });

export const pickSort =
  ({ navigation }) =>
  (event: React.ChangeEvent<HTMLSelectElement>) =>
    navigation.query('/products', { ...sorting(event.currentTarget.value), page: 1 });
