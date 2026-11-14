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

export default ({ askToSignIn, brand, className, dialogs, navigating, signInReason, skip, states, world }) => (
  <div aria-busy={navigating} className={className}>
    <Button className="skip" onPress={() => document.getElementById('main')?.focus()}>
      {skip}
    </Button>
    <header>
      <div className="brand">
        <span aria-hidden="true" className="mark" />
        <h1>{brand}</h1>
        <span className="badge">{world}</span>
      </div>
      <Link className="react-aria-Link states" data-variant="quiet" href="#/states">
        {states}
      </Link>
      <Lab />
      <Language />
      <Keyboard />
      <Session asked={askToSignIn} reason={signInReason} />
    </header>
    <div className="progress" data-active={navigating || undefined} role="presentation" />
    <main id="main" tabIndex={-1}>
      <Catalogue />
    </main>
    {/* The product's modal opens at once; the product's dialog waits for its read inside it. */}
    {dialogs.view !== null && (
      <Modal onClose={() => go({ view: null })} size="large">
        <Detail />
      </Modal>
    )}
    {dialogs.edit !== null && <Editor key={`edit-${dialogs.edit}`} />}
    {dialogs.create && <Editor key="create" />}
    {dialogs.remove !== null && <Remove key={dialogs.remove} />}
    {dialogs.bulk && <BulkPrice />}
  </div>
);
