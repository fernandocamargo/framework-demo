// GrowthBook as an OpenFeature provider, on GrowthBook's SDK. GrowthBook's own OpenFeature provider
// is written for the SDK's previous major version; this is the same few lines on the current one.
//
// The person's targeting key goes to GrowthBook's `id`, its hash attribute, and the rest of the
// context (the role) beside it. With streaming, GrowthBook pushes every change of its flags, and
// the provider says its flags changed. It says so only for a new payload: the SDK also calls back
// when the person changes, and the flags read for a new person would otherwise read itself again.

import type { GrowthBook, InitOptions } from '@growthbook/growthbook';
import {
  ErrorCode,
  type EvaluationContext,
  type JsonValue,
  OpenFeatureEventEmitter,
  type Provider,
  ProviderEvents,
  type ResolutionDetails,
} from '@openfeature/web-sdk';

const attributesOf = ({ targetingKey, ...rest }: EvaluationContext) => ({ ...rest, id: targetingKey });

/** A provider over `growthbook`, which it starts with `init` (`{ streaming: true }`, or a payload in tests). */
export function growthbookProvider(growthbook: GrowthBook, init: InitOptions): Provider {
  const events = new OpenFeatureEventEmitter();
  const resolve = <Value>(key: string, fallback: Value): ResolutionDetails<Value> => {
    const result = growthbook.evalFeature(key);
    if (result.source === 'unknownFeature')
      return { errorCode: ErrorCode.FLAG_NOT_FOUND, reason: 'ERROR', value: fallback };
    if (result.value === null) return { reason: 'DEFAULT', value: fallback };
    if (typeof result.value !== typeof fallback)
      return { errorCode: ErrorCode.TYPE_MISMATCH, reason: 'ERROR', value: fallback };
    return {
      reason: result.source === 'force' ? 'TARGETING_MATCH' : result.source === 'experiment' ? 'SPLIT' : 'STATIC',
      value: result.value as Value,
    };
  };
  return {
    events,
    async initialize(context) {
      if (context) await growthbook.setAttributes(attributesOf(context));
      await growthbook.init(init);
      let payload = growthbook.getPayload();
      growthbook.setRenderer(() => {
        if (growthbook.getPayload() === payload) return;
        payload = growthbook.getPayload();
        events.emit(ProviderEvents.ConfigurationChanged);
      });
    },
    metadata: { name: 'growthbook' },
    async onClose() {
      growthbook.destroy();
    },
    async onContextChange(_, context) {
      await growthbook.setAttributes(attributesOf(context));
    },
    resolveBooleanEvaluation: (key, fallback) => resolve(key, fallback),
    resolveNumberEvaluation: (key, fallback) => resolve(key, fallback),
    resolveObjectEvaluation: <Value extends JsonValue>(key: string, fallback: Value) => resolve(key, fallback),
    resolveStringEvaluation: (key, fallback) => resolve(key, fallback),
    runsOn: 'client',
  };
}
