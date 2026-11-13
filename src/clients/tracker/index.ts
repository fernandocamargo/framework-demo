// A destination for what the framework's pipelines carry: every interaction a render's `on…`
// handler receives, with the place it was written, and every failure, with the layer that
// caught it. An analytics tool or an error tracker would plug in the same way; this one keeps
// the last few, for the network lab to show.
import { connect, consent, onFailure, type Failure, type Interaction } from 'framework'

export type Tracked = { id: number; at: number; kind: 'interaction' | 'failure'; text: string; where: string }

export default ({ env: _ }) => {
  let entries: Tracked[] = []
  const add = (entry: Tracked) => {
    entries = [entry, ...entries].slice(0, 40)
  }
  consent.grant('diagnostics')
  connect({
    name: 'lab',
    purpose: 'diagnostics',
    map: (interaction: Interaction): Tracked => ({
      id: interaction.id,
      at: Date.now(),
      kind: 'interaction',
      text: `${interaction.site.element}.${interaction.site.prop}`,
      where: `${interaction.site.file}:${interaction.site.line}`,
    }),
    send: (batch) => batch.forEach(add),
  })
  onFailure((failure: Failure) =>
    add({
      id: failure.id,
      at: Date.now(),
      kind: 'failure',
      text: failure.error.message,
      where: `${failure.layer}${failure.path ? ` · ${failure.path}` : ''}${failure.during ? ` · ${failure.during}` : ''}`,
    }),
  )
  return { recent: (): Tracked[] => entries }
}
