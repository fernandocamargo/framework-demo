// Each chart and each of its states, with the address of the frame that shows it: the same page
// in the memory world, in the locale on screen, holding the component in that state.
export default ({ i18n, locale, async: { default: charts } }) => ({
  i18n,
  charts: charts.map((chart) => ({
    path: chart.path,
    file: `${chart.path}/state.ts`,
    description: chart.description,
    count: i18n.count({ count: chart.states.length }),
    states: chart.states.map((state) => ({
      path: state.path,
      name: state.name,
      depth: state.depth,
      description: state.description,
      example: chart.examples[state.path] ? i18n.example : null,
      title: i18n.frame({ path: chart.path, state: state.path }),
      src: `?world=memory&lang=${locale}#/states/${encodeURIComponent(chart.path)}/${state.path}`,
    })),
  })),
})
