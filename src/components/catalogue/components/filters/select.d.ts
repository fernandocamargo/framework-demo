import type { DetailedHTMLProps, HTMLAttributes } from 'react';

// The installed React declarations do not yet name the customizable select's content element.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      selectedcontent: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
