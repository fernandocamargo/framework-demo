import { Button, Link } from 'react-aria-components';

import BulkPrice from '@/components/bulk-price';
import Catalogue from '@/components/catalogue';
import Keyboard from '@/components/keyboard';
import Lab from '@/components/lab';
import Language from '@/components/language';
import Modal from '@/components/modal';
import Orders from '@/components/orders';
import OrderDetail from '@/components/orders/detail';
import Palette from '@/components/palette';
import Detail from '@/components/product/detail';
import Editor from '@/components/product/editor';
import Remove from '@/components/product/remove';
import Report from '@/components/report';
import Session from '@/components/session';
import Skin from '@/components/skin';
import Tour from '@/components/tour';

// The page, as schema.org names one: its name, the data it is based on (the world it reads), and the
// catalogue in its main part.
export default ({
  askToSignIn,
  brand,
  className,
  dialogs,
  handlers,
  navigating,
  section,
  sections,
  signInReason,
  skip,
  states,
  world,
}) => (
  <div aria-busy={navigating} className={className} itemScope itemType="https://schema.org/WebPage">
    <Button onPress={handlers.skipToContent}>{skip}</Button>
    <header>
      <hgroup>
        <h1 itemProp="name">{brand}</h1>
        <p itemProp="isBasedOn" itemScope itemType="https://schema.org/Dataset">
          <span itemProp="name">{world}</span>
        </p>
      </hgroup>
      <Tour />
      <nav>
        {sections.map((item) => (
          <Link aria-current={item.current ? 'page' : undefined} href={item.href} key={item.id}>
            {item.label}
          </Link>
        ))}
        <Link href="#/states">{states}</Link>
      </nav>
      <Lab />
      <Language />
      <Skin />
      <Palette />
      <Keyboard />
      <Session asked={askToSignIn} reason={signInReason} />
    </header>
    <main id="main" tabIndex={-1}>
      {section === 'products' && <Catalogue />}
      {section === 'report' && <Report />}
      {section === 'orders' && <Orders />}
    </main>
    {/* The product's modal opens at once; the product's dialog waits for its read inside it. */}
    {dialogs.view !== null && (
      <Modal onClose={handlers.closeProduct}>
        <Detail />
      </Modal>
    )}
    {dialogs.cart !== null && (
      <Modal onClose={handlers.closeOrder}>
        <OrderDetail />
      </Modal>
    )}
    {dialogs.edit !== null && <Editor key={`edit-${dialogs.edit}`} />}
    {dialogs.create && <Editor key="create" />}
    {dialogs.remove !== null && <Remove key={dialogs.remove} />}
    {dialogs.bulk && <BulkPrice />}
  </div>
);
