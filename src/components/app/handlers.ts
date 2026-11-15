// What the page's events do: the skip button moves focus to the main part, and a modal's close
// takes its dialog's key out of the address.
import { go } from '@/address';

export const skipToContent = () => () => document.getElementById('main')?.focus();
export const closeProduct = () => () => go({ view: null });
export const closeOrder = () => () => go({ cart: null });
