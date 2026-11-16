import Modal from '@/components/modal';

import Detail from './components/detail';

export default ({ covered, handlers, routes }) => (
  <>
    <Modal covered={covered} onClose={handlers.closeProduct}>
      <Detail />
    </Modal>
    {routes}
  </>
);
