import { Fragment } from 'react';

import Modal from '@/components/modal';

import Detail from './components/detail';

export default ({ closeHref, covered, handlers, id, removeHref, routes }) => (
  <>
    <Modal covered={covered} onClose={handlers.closeProduct}>
      <Detail closeHref={closeHref} id={id} key={id} removeHref={removeHref} />
    </Modal>
    <Fragment key={id}>{routes}</Fragment>
  </>
);
