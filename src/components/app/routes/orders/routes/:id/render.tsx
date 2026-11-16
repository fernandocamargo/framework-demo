import Modal from '@/components/modal';

import OrderDetail from './components/detail';

export default ({ allowed, closeHref, handlers, id, settings }) =>
  allowed && (
    <Modal onClose={handlers.closeOrder}>
      <OrderDetail closeHref={closeHref} id={id} key={id} settings={settings} />
    </Modal>
  );
