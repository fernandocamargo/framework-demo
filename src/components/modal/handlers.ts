export const dismiss =
  ({ onClose }) =>
  (open: boolean) =>
    !open && onClose();
