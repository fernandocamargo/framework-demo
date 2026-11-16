import Modal from '@/components/modal';

import OrderDetail from './components/detail';

export default ({ allowed, handlers }) =>
  allowed && (
    <Modal onClose={handlers.closeOrder}>
      <OrderDetail />
    </Modal>
  );
