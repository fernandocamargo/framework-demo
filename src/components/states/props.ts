// Each chart and each of its states, with the address of the frame that shows it: the same page
// in the memory world, in the locale and the skin on screen, holding the component in that state.

import { currentSkin } from '@/skins';

export default ({ async: { default: charts }, i18n, locale }) => ({
  charts: charts.map((chart) => ({
    count: i18n.count({ count: chart.states.length }),
    description: chart.description,
    file: `${chart.path}/state.ts`,
    path: chart.path,
    states: chart.states.map((state) => ({
      depth: state.depth,
      description: state.description,
      example: chart.examples[state.path] ? i18n.example : null,
      name: state.name,
      path: state.path,
      src: `?world=memory&lang=${locale}${currentSkin() === 'default' ? '' : `&skin=${currentSkin()}`}#/states/${encodeURIComponent(chart.path)}/${state.path}`,
      title: i18n.frame({ path: chart.path, state: state.path }),
    })),
  })),
  i18n,
});
