export const dismiss =
  ({ onClose }) =>
  (open: boolean) =>
    !open && onClose();

export const type =
  ({ onType }) =>
  (text: string) =>
    onType(text);
