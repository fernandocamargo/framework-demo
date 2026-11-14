import { Button, Link } from 'react-aria-components';

import { go } from '@/address';
import BulkPrice from '@/components/bulk-price';
import Catalogue from '@/components/catalogue';
import Keyboard from '@/components/keyboard';
import Lab from '@/components/lab';
import Language from '@/components/language';
import Modal from '@/components/modal';
import Detail from '@/components/product/detail';
import Editor from '@/components/product/editor';
import Remove from '@/components/product/remove';
import Session from '@/components/session';

// The page, as schema.org names one: its name, the data it is based on (the world it reads), and the
// catalogue in its main part.
export default ({ askToSignIn, brand, className, dialogs, navigating, signInReason, skip, states, world }) => (
  <div aria-busy={navigating} className={className} itemScope itemType="https://schema.org/WebPage">
    <Button onPress={() => document.getElementById('main')?.focus()}>{skip}</Button>
    <header>
      <hgroup>
        <h1 itemProp="name">{brand}</h1>
        <p itemProp="isBasedOn" itemScope itemType="https://schema.org/Dataset">
          <span itemProp="name">{world}</span>
        </p>
      </hgroup>
      <nav>
        <Link href="#/states">{states}</Link>
      </nav>
      <Lab />
      <Language />
      <Keyboard />
      <Session asked={askToSignIn} reason={signInReason} />
    </header>
    <main id="main" tabIndex={-1}>
      <Catalogue />
    </main>
    {/* The product's modal opens at once; the product's dialog waits for its read inside it. */}
    {dialogs.view !== null && (
      <Modal onClose={() => go({ view: null })}>
        <Detail />
      </Modal>
    )}
    {dialogs.edit !== null && <Editor key={`edit-${dialogs.edit}`} />}
    {dialogs.create && <Editor key="create" />}
    {dialogs.remove !== null && <Remove key={dialogs.remove} />}
    {dialogs.bulk && <BulkPrice />}
  </div>
);
