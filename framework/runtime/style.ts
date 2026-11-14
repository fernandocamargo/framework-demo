/**
 * Skins: static, plain CSS in `style/skins/<name>/index.ts`, nested under the
 * component's class, which is its folder's path. One skin is active for the whole page,
 * chosen by `Root`. A skin's CSS goes into the page once, when the first instance of its
 * component renders with that skin active, and stays.
 *
 * Left for later: a provider that overrides the skin for a subtree, removing CSS
 * with the last instance, and composing shared CSS.
 */

import { hold } from './activity';
import { tracked } from './thenable';

/**
 * Tags a skin's CSS. As `String.raw`, it keeps every backslash, so an escaped selector
 * survives, and it never transforms the text.
 */
export const css = String.raw;

/** The selector for a component's class: its path, escaped (`.components\/app`). */
export const selector = (path: string) => `.${CSS.escape(path)}`;

export type SkinModule = { default: string };

const loads = new Map<string, Promise<void>>();
const sheets = new Map<string, HTMLStyleElement>();
let active = 'default';

const media = (skin: string | undefined) => (skin === active ? 'all' : 'not all');

/** The page's skin, which a preload loads ahead of the component's first render. */
export const activeSkin = () => active;

/**
 * Makes `skin` the page's skin: its sheets apply, every other skin's sheets stop applying. The page
 * says which it is (`<html data-skin>`), for what no component owns: the page's own sheet, and
 * what react-aria renders in portals.
 */
export function activateSkin(skin: string) {
  document.documentElement.dataset['skin'] = skin;
  if (skin === active) return;
  active = skin;
  for (const sheet of sheets.values()) sheet.media = media(sheet.dataset['skin']);
}

/** Loads a component's skin once and puts it in the page. Resolves when the CSS is in. */
export function loadSkin(path: string, skin: string, load: () => Promise<SkinModule>) {
  const key = `${path}|${skin}`;
  let promise = loads.get(key);
  if (!promise) {
    promise = tracked(
      hold(
        load().then(({ default: rules }) => {
          const sheet = document.createElement('style');
          sheet.dataset['component'] = path;
          sheet.dataset['skin'] = skin;
          sheet.media = media(skin);
          sheet.textContent = `${selector(path)} {\n${rules}\n}`;
          document.head.append(sheet);
          sheets.set(key, sheet);
        }),
      ),
    );
    loads.set(key, promise);
  }
  return promise;
}
