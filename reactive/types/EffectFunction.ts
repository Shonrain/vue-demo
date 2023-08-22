import { EffectOptions } from "./EffectOptions"

export type EffectFunction = {
  (): void,
  deps: Array<Set<EffectFunction>>,
  options?: EffectOptions
}
