import { Button } from 'react-aria-components';

import Keyboard from '@/components/keyboard';
import Lab from '@/components/lab';
import Language from '@/components/language';
import Palette from '@/components/palette';
import Session from '@/components/session';
import Skin from '@/components/skin';
import Tour from '@/components/tour';

// The page, as schema.org names one: its name, the data it is based on (the world it reads), and the
// catalogue in its main part.
export default ({
  askToSignIn,
  brand,
  className,
  handlers,
  lang,
  productOpen,
  routes,
  sections,
  signInReason,
  skin,
  skip,
  states,
  world,
}) => (
  <div className={className} itemScope itemType="https://schema.org/WebPage">
    <Button onPress={handlers.skipToContent}>{skip}</Button>
    <header>
      <hgroup>
        <h1 itemProp="name">{brand}</h1>
        <p itemProp="isBasedOn" itemScope itemType="https://schema.org/Dataset">
          <span itemProp="name">{world}</span>
        </p>
      </hgroup>
      <Tour lang={lang} skin={skin} />
      <nav>
        {sections.map((item) => (
          <a aria-current={item.current ? 'page' : undefined} href={item.href} key={item.id} tabIndex={0}>
            {item.label}
          </a>
        ))}
        <a href="#/states" tabIndex={0}>
          {states}
        </a>
      </nav>
      <Lab />
      <Language />
      <Skin skin={skin} />
      <Palette />
      <Keyboard />
      <Session asked={askToSignIn} productOpen={productOpen} reason={signInReason} />
    </header>
    <main id="main" tabIndex={-1}>
      {routes}
    </main>
  </div>
);
