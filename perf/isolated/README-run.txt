vite v8.3.5 building client environment for production...
transforming...
✓ 1331 modules transformed.
rendering chunks...
computing gzip size...
perf/isolated/node_modules/.vite/dist/index.html                    1.65 kB │ gzip:   0.69 kB
perf/isolated/node_modules/.vite/dist/assets/index-BE2ZToqw.js  1,067.83 kB │ gzip: 214.68 kB

✓ built in 101ms

chromium: committed renders (re-renders with no page change)
Interaction              |              aria-docs |         aria-framework |                 native
type lamp and Enter      |              245 (205) |                 48 (8) |                 23 (0)
choose sort              |              297 (141) |              265 (109) |                 15 (0)
choose category          |              530 (296) |              498 (264) |                 15 (0)
next page                |                68 (50) |                 22 (4) |                 15 (2)
previous page            |                59 (46) |                 13 (0) |                 15 (2)

Largest cells with no change (top six component groups each):
aria-docs / choose category: 530 renders, 79 mounted, 296 with no change
  86 × $7230ffa83bc0c2cf$export$2881499e37b75b9a
    61 × props: values (equal value, new identity)
    23 × props: values
    2 × props: values (equal value, new identity), children (equal value, new identity)
  59 × bound $7230ffa83bc0c2cf$var$DOMElement (under Component)
    59 × props: children, onFocus (equal value, new identity), onKeyDown (equal value, new identity), onClick (equal value, new identity), onPointerDown (equal value, new identity), onMouseDown (equal value, new identity), onPointerUp (equal value, new identity), onPointerEnter (equal value, new identity), onPointerLeave (equal value, new identity), onDragStart (equal value, new identity), onDragStartCapture (equal value, new identity)
  59 × Component
    59 × own: hooks [60, 61, 65, 69, 74, 77, 94, 95, 103, 108, 111, 124, 141], contexts [context, context]
  18 × bound $7230ffa83bc0c2cf$var$DOMElement
    8 × props: children (equal value, new identity)
    4 × props: children (equal value, new identity), onFocus (equal value, new identity), onBlur (equal value, new identity), onKeyDown (equal value, new identity), onKeyUp (equal value, new identity), onClick (equal value, new identity), onPointerDown (equal value, new identity), onMouseDown (equal value, new identity), onPointerUp (equal value, new identity), onPointerEnter (equal value, new identity), onPointerLeave (equal value, new identity), onDragStart (equal value, new identity)
    2 × props: children
  10 × $081058010ef8962e$export$2317d149ed6f78c4
    10 × parent with equal props
  10 × $ea3928288112382f$export$439d29a4e110a164 (under $081058010ef8962e$export$2317d149ed6f78c4)
    10 × props: children (equal value, new identity)
aria-framework / choose category: 498 renders, 79 mounted, 264 with no change
  85 × $7230ffa83bc0c2cf$export$2881499e37b75b9a
    61 × props: values (equal value, new identity)
    23 × props: values
    1 × props: values (equal value, new identity), children (equal value, new identity)
  59 × bound $7230ffa83bc0c2cf$var$DOMElement (under Component)
    59 × props: children, onFocus (equal value, new identity), onKeyDown (equal value, new identity), onClick (equal value, new identity), onPointerDown (equal value, new identity), onMouseDown (equal value, new identity), onPointerUp (equal value, new identity), onPointerEnter (equal value, new identity), onPointerLeave (equal value, new identity), onDragStart (equal value, new identity), onDragStartCapture (equal value, new identity)
  59 × Component
    59 × own: hooks [60, 61, 65, 69, 74, 77, 94, 95, 103, 108, 111, 124, 141], contexts [context, context]
  12 × bound $7230ffa83bc0c2cf$var$DOMElement
    7 × props: children (equal value, new identity)
    3 × props: children (equal value, new identity), onFocus (equal value, new identity), onBlur (equal value, new identity), onKeyDown (equal value, new identity), onKeyUp (equal value, new identity), onClick (equal value, new identity), onPointerDown (equal value, new identity), onMouseDown (equal value, new identity), onPointerUp (equal value, new identity), onPointerEnter (equal value, new identity), onPointerLeave (equal value, new identity), onDragStart (equal value, new identity)
    1 × props: children, onFocus (equal value, new identity), onBlur (equal value, new identity), onKeyDownCapture (equal value, new identity), onKeyDown (equal value, new identity), onKeyUp (equal value, new identity), onMouseDown (equal value, new identity)
  10 × $081058010ef8962e$export$2317d149ed6f78c4
    10 × parent with equal props
  10 × $ea3928288112382f$export$439d29a4e110a164 (under $081058010ef8962e$export$2317d149ed6f78c4)
    10 × props: children (equal value, new identity)
aria-docs / type lamp and Enter: 245 renders, 0 mounted, 205 with no change
  37 × bound $7230ffa83bc0c2cf$var$DOMElement
    11 × props: children
    10 × props: children (equal value, new identity), onFocus (equal value, new identity), onBlur (equal value, new identity), onKeyDown (equal value, new identity), onKeyUp (equal value, new identity), onClick (equal value, new identity), onPointerDown (equal value, new identity), onMouseDown (equal value, new identity), onPointerUp (equal value, new identity), onPointerEnter (equal value, new identity), onPointerLeave (equal value, new identity), onDragStart (equal value, new identity)
    10 × props: children (equal value, new identity)
  25 × Button
    20 × props: children (equal value, new identity)
    5 × parent with equal props
  20 × $42ceafc619f9c3ba$export$bf788dd355e3a401
    10 × props: content, children (equal value, new identity)
    10 × props: content (equal value, new identity), children (equal value, new identity)
  20 × Popover
    20 × props: children (equal value, new identity)
  10 × $42ceafc619f9c3ba$export$fb8073518f34e6ec (under $42ceafc619f9c3ba$export$bf788dd355e3a401)
    10 × parent with equal props
  10 × $42ceafc619f9c3ba$var$CollectionInner (under $42ceafc619f9c3ba$export$bf788dd355e3a401)
    10 × props: render (equal value, new identity)
15 interaction checks passed; full commits and causes: perf/isolated/out/chromium.json

webkit: committed renders (re-renders with no page change)
Interaction              |              aria-docs |         aria-framework |                 native
type lamp and Enter      |              245 (205) |                 48 (8) |                 23 (0)
choose sort              |              300 (142) |              268 (110) |                 15 (0)
choose category          |              533 (297) |              501 (265) |                 15 (0)
next page                |                68 (50) |                 22 (4) |                 15 (2)
previous page            |                59 (46) |                 13 (0) |                 15 (2)

Largest cells with no change (top six component groups each):
aria-docs / choose category: 533 renders, 79 mounted, 297 with no change
  87 × $7230ffa83bc0c2cf$export$2881499e37b75b9a
    62 × props: values (equal value, new identity)
    23 × props: values
    2 × props: values (equal value, new identity), children (equal value, new identity)
  59 × bound $7230ffa83bc0c2cf$var$DOMElement (under Component)
    59 × props: children, onFocus (equal value, new identity), onKeyDown (equal value, new identity), onClick (equal value, new identity), onPointerDown (equal value, new identity), onMouseDown (equal value, new identity), onPointerUp (equal value, new identity), onPointerEnter (equal value, new identity), onPointerLeave (equal value, new identity), onDragStart (equal value, new identity), onDragStartCapture (equal value, new identity)
  59 × Component
    59 × own: hooks [60, 61, 65, 69, 74, 77, 94, 95, 103, 108, 111, 124, 141], contexts [context, context]
  18 × bound $7230ffa83bc0c2cf$var$DOMElement
    8 × props: children (equal value, new identity)
    4 × props: children (equal value, new identity), onFocus (equal value, new identity), onBlur (equal value, new identity), onKeyDown (equal value, new identity), onKeyUp (equal value, new identity), onClick (equal value, new identity), onPointerDown (equal value, new identity), onMouseDown (equal value, new identity), onPointerUp (equal value, new identity), onPointerEnter (equal value, new identity), onPointerLeave (equal value, new identity), onDragStart (equal value, new identity)
    2 × props: children
  10 × $081058010ef8962e$export$2317d149ed6f78c4
    10 × parent with equal props
  10 × $ea3928288112382f$export$439d29a4e110a164 (under $081058010ef8962e$export$2317d149ed6f78c4)
    10 × props: children (equal value, new identity)
aria-framework / choose category: 501 renders, 79 mounted, 265 with no change
  86 × $7230ffa83bc0c2cf$export$2881499e37b75b9a
    62 × props: values (equal value, new identity)
    23 × props: values
    1 × props: values (equal value, new identity), children (equal value, new identity)
  59 × bound $7230ffa83bc0c2cf$var$DOMElement (under Component)
    59 × props: children, onFocus (equal value, new identity), onKeyDown (equal value, new identity), onClick (equal value, new identity), onPointerDown (equal value, new identity), onMouseDown (equal value, new identity), onPointerUp (equal value, new identity), onPointerEnter (equal value, new identity), onPointerLeave (equal value, new identity), onDragStart (equal value, new identity), onDragStartCapture (equal value, new identity)
  59 × Component
    59 × own: hooks [60, 61, 65, 69, 74, 77, 94, 95, 103, 108, 111, 124, 141], contexts [context, context]
  12 × bound $7230ffa83bc0c2cf$var$DOMElement
    7 × props: children (equal value, new identity)
    3 × props: children (equal value, new identity), onFocus (equal value, new identity), onBlur (equal value, new identity), onKeyDown (equal value, new identity), onKeyUp (equal value, new identity), onClick (equal value, new identity), onPointerDown (equal value, new identity), onMouseDown (equal value, new identity), onPointerUp (equal value, new identity), onPointerEnter (equal value, new identity), onPointerLeave (equal value, new identity), onDragStart (equal value, new identity)
    1 × props: children, onFocus (equal value, new identity), onBlur (equal value, new identity), onKeyDownCapture (equal value, new identity), onKeyDown (equal value, new identity), onKeyUp (equal value, new identity), onMouseDown (equal value, new identity)
  10 × $081058010ef8962e$export$2317d149ed6f78c4
    10 × parent with equal props
  10 × $ea3928288112382f$export$439d29a4e110a164 (under $081058010ef8962e$export$2317d149ed6f78c4)
    10 × props: children (equal value, new identity)
aria-docs / type lamp and Enter: 245 renders, 0 mounted, 205 with no change
  37 × bound $7230ffa83bc0c2cf$var$DOMElement
    11 × props: children
    10 × props: children (equal value, new identity), onFocus (equal value, new identity), onBlur (equal value, new identity), onKeyDown (equal value, new identity), onKeyUp (equal value, new identity), onClick (equal value, new identity), onPointerDown (equal value, new identity), onMouseDown (equal value, new identity), onPointerUp (equal value, new identity), onPointerEnter (equal value, new identity), onPointerLeave (equal value, new identity), onDragStart (equal value, new identity)
    10 × props: children (equal value, new identity)
  25 × Button
    20 × props: children (equal value, new identity)
    5 × parent with equal props
  20 × $42ceafc619f9c3ba$export$bf788dd355e3a401
    10 × props: content, children (equal value, new identity)
    10 × props: content (equal value, new identity), children (equal value, new identity)
  20 × Popover
    20 × props: children (equal value, new identity)
  10 × $42ceafc619f9c3ba$export$fb8073518f34e6ec (under $42ceafc619f9c3ba$export$bf788dd355e3a401)
    10 × parent with equal props
  10 × $42ceafc619f9c3ba$var$CollectionInner (under $42ceafc619f9c3ba$export$bf788dd355e3a401)
    10 × props: render (equal value, new identity)
15 interaction checks passed; full commits and causes: perf/isolated/out/webkit.json
