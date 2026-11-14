// A live MapLibre map for a figure of observations of US states. It is given no data: it reads the
// figure's schema.org items (read.ts), the way a search engine would, and draws a circle for each
// state that has orders. The list stays the page's: it is what a keyboard and a screen reader use,
// and what shows whenever the map cannot.
//
// It is a React ref callback, so React attaches it with the figure and runs its cleanup when the
// figure goes or the ref is no longer given (the flag turned off). Colours come from the skin: the
// figure's `accent-color` fills the circles and its `color` outlines them.

import type { GeoJSONSource, Map as MapLibre } from 'maplibre-gl';

import { features, read } from './read';

/** The contiguous United States: south-west and north-east corners, as [longitude, latitude]. */
const BOUNDS: [[number, number], [number, number]] = [
  [-125, 24],
  [-66.5, 49.5],
];
const SOURCE = 'orders';
const LAYER = 'orders';

// MapLibre 6 draws with WebGL 2 only: without it, the list stays the map.
const supported = () => {
  const canvas = document.createElement('canvas');
  try {
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
};

/** A colour as the style can read it: the browser's resolved value, written as sRGB by a canvas. */
const paint = (value: string, fallback: string) => {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return fallback;
  context.fillStyle = '#000000';
  context.fillStyle = value;
  return context.fillStyle;
};

const colours = (figure: HTMLElement) => {
  const { accentColor, color } = getComputedStyle(figure);
  return { fill: paint(accentColor, '#3451d1'), stroke: paint(color, '#ffffff') };
};

function attach(figure: HTMLElement, style: string): () => void {
  if (!supported()) return () => {};

  // The map goes before the list, where it shows, so the order a keyboard meets things in is the
  // order they are seen in. The figure's children are fixed markup, so React has nothing to move
  // past it.
  const host = document.createElement('div');
  host.hidden = true;
  figure.insertBefore(host, figure.querySelector(':scope > ol'));

  let done = false;
  let map: MapLibre | undefined;
  const observers: (MutationObserver | ResizeObserver | undefined)[] = [];
  const unlisten: (() => void)[] = [];

  const stop = () => {
    done = true;
    observers.forEach((observer) => observer?.disconnect());
    unlisten.forEach((off) => off());
    map?.remove();
    map = undefined;
    host.remove();
  };
  // Anything that goes wrong before the map shows leaves the grid as it was.
  const fail = () => {
    if (!done) stop();
  };

  // The library's worker is a file of its own that the bundle does not carry: the build emits it, and
  // the library is told where it is, as the page's base path puts it.
  void Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl.css'),
    import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
  ])
    .then(([maplibre, , worker]) => {
      if (done) return;
      maplibre.setWorkerUrl(worker.default);
      const list = figure.querySelector('ol');
      const created = new maplibre.Map({
        attributionControl: { compact: true },
        bounds: BOUNDS,
        container: host,
        doubleClickZoom: true,
        dragRotate: false,
        fadeDuration: 0,
        maxPitch: 0,
        pitchWithRotate: false,
        style,
        touchPitch: false,
      });
      map = created;
      created.touchZoomRotate.disableRotation();
      // The canvas adds nothing to read or reach: the list is the page's. The attribution links stay.
      const canvas = created.getCanvas();
      canvas.tabIndex = -1;
      canvas.removeAttribute('role');
      canvas.removeAttribute('aria-label');
      canvas.setAttribute('aria-hidden', 'true');
      created.getCanvasContainer().setAttribute('aria-hidden', 'true');

      created.on('error', () => {
        if (!created.loaded()) fail();
      });
      created.on('webglcontextlost', fail);

      created.once('load', () => {
        if (done) return;
        let observations = read(figure);
        created.addSource(SOURCE, { data: features(observations), type: 'geojson' });
        const { fill, stroke } = colours(figure);
        created.addLayer({
          // A state with no orders draws nothing: no circle, and no outline of one.
          filter: ['>', ['get', 'count'], 0],
          id: LAYER,
          paint: {
            'circle-color': fill,
            'circle-opacity': 0.7,
            'circle-radius': ['*', 7, ['sqrt', ['get', 'count']]],
            'circle-stroke-color': stroke,
            'circle-stroke-width': ['case', ['get', 'current'], 3, 1],
          },
          source: SOURCE,
          type: 'circle',
        });

        const show = () => {
          (created.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(features(observations));
        };
        const recolour = () => {
          if (done || !created.getLayer(LAYER)) return;
          const next = colours(figure);
          created.setPaintProperty(LAYER, 'circle-color', next.fill);
          created.setPaintProperty(LAYER, 'circle-stroke-color', next.stroke);
        };

        created.on('click', LAYER, ({ features: hit }) => {
          const code = hit?.[0]?.properties['code'];
          observations.find((observation) => observation.code === code)?.link?.click();
        });
        created.on('mouseenter', LAYER, () => {
          canvas.style.cursor = 'pointer';
        });
        created.on('mouseleave', LAYER, () => {
          canvas.style.cursor = '';
        });

        // The list is the source of truth: whatever changes in it changes the circles.
        if (list) {
          const items = new MutationObserver(() => {
            if (done) return;
            observations = read(figure);
            show();
          });
          items.observe(list, { attributes: true, characterData: true, childList: true, subtree: true });
          observers.push(items);
        }
        const skin = new MutationObserver(recolour);
        skin.observe(document.documentElement, { attributeFilter: ['data-skin'], attributes: true });
        observers.push(skin);
        const scheme = matchMedia('(prefers-color-scheme: dark)');
        scheme.addEventListener('change', recolour);
        unlisten.push(() => scheme.removeEventListener('change', recolour));

        host.hidden = false;
        // The country fits whatever frame the skin gives the map, and fits again when the frame
        // changes: another skin, a narrower window, the lab docked beside the page.
        let frame = '';
        const fit = new ResizeObserver(([entry]) => {
          const size = `${Math.round(entry?.contentRect.width ?? 0)}x${Math.round(entry?.contentRect.height ?? 0)}`;
          if (done || size === frame) return;
          frame = size;
          created.resize();
          // The country sits above the attribution, which takes two lines on a narrow map.
          const credits = host.querySelector('.maplibregl-ctrl-attrib')?.getBoundingClientRect().height ?? 0;
          created.fitBounds(BOUNDS, { animate: false, padding: { bottom: credits + 8, left: 8, right: 8, top: 8 } });
        });
        fit.observe(host);
        observers.push(fit);
      });
    })
    .catch(fail);

  return stop;
}

const callbacks = new Map<string, (figure: HTMLElement | null) => (() => void) | void>();

/**
 * The ref callback that puts the live map in a figure of observations, drawn with this style. The
 * same function for the same style, so React neither detaches nor attaches it again at a render.
 */
export function liveMap(style: string): (figure: HTMLElement | null) => (() => void) | void {
  let callback = callbacks.get(style);
  if (!callback) {
    callback = (figure) => (figure ? attach(figure, style) : undefined);
    callbacks.set(style, callback);
  }
  return callback;
}
