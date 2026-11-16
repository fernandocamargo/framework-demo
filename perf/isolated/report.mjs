export const VARIANTS = ['aria-docs', 'aria-framework', 'native'];
export const INTERACTIONS = ['type lamp and Enter', 'choose sort', 'choose category', 'next page', 'previous page'];

export function summarize(commits, interaction) {
  const components = commits.filter((commit) => commit.phase === interaction).flatMap((commit) => commit.components);
  const unchanged = components.filter((component) => !component.mounted && !component.dom);
  const groups = new Map();
  for (const component of unchanged) {
    const name = component.under ? `${component.name} (under ${component.under})` : component.name;
    const group = groups.get(name) ?? { causes: {}, count: 0, name };
    group.count++;
    const why = component.why;
    const cause =
      why?.cause === 'props'
        ? `props: ${why.changed.map(({ key, sameValue }) => `${key}${sameValue ? ' (equal value, new identity)' : ''}`).join(', ')}`
        : why?.cause === 'own'
          ? `own: hooks [${why.hooks.join(', ')}], contexts [${why.contexts.join(', ')}]`
          : 'parent with equal props';
    group.causes[cause] = (group.causes[cause] ?? 0) + 1;
    groups.set(name, group);
  }
  return {
    interaction,
    mounted: components.filter((component) => component.mounted).length,
    names: [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    renders: components.length,
    unchanged: unchanged.length,
  };
}

export function table(engine, results) {
  const lines = [
    `\n${engine}: committed renders (re-renders with no page change)`,
    ['Interaction'.padEnd(24), ...VARIANTS.map((variant) => variant.padStart(22))].join(' | '),
  ];
  for (const interaction of INTERACTIONS)
    lines.push(
      [
        interaction.padEnd(24),
        ...VARIANTS.map((variant) => {
          const cell = results.find((result) => result.variant === variant && result.interaction === interaction);
          if (!cell) throw new Error(`Missing ${engine}/${variant}/${interaction}`);
          return `${cell.renders} (${cell.unchanged})`.padStart(22);
        }),
      ].join(' | '),
    );
  lines.push('\nLargest cells with no change (top six component groups each):');
  for (const cell of [...results].sort((a, b) => b.unchanged - a.unchanged || b.renders - a.renders).slice(0, 3)) {
    lines.push(
      `${cell.variant} / ${cell.interaction}: ${cell.renders} renders, ${cell.mounted} mounted, ${cell.unchanged} with no change`,
    );
    for (const group of cell.names.slice(0, 6)) {
      lines.push(`  ${group.count} × ${group.name}`);
      for (const [cause, count] of Object.entries(group.causes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3))
        lines.push(`    ${count} × ${cause}`);
    }
  }
  return lines.join('\n');
}
