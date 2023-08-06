export type EffectFunction = {
  (): void,
  deps: Array<Set<EffectFunction>>
}
