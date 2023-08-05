type EffectFunction = {
  (): void,
  deps: Array<Set<EffectFunction>>
}

let activeEffect: EffectFunction | null = null;
const effectStack: Array<EffectFunction> = [];
const bucket: WeakMap<Record<string, any>, Map<string, Set<EffectFunction>>> = new WeakMap();

export const getData = (obj: Record<string, any>) => {
  return new Proxy(obj, {
    get(target: Record<string, any>, key: string) {
      track(target, key);
      return target[key];
    },
    set(target: Record<string, any>, key: string, value: any) {
      target[key] = value;
      trigger(target, key);
      return true;
    }
  });
};

const track = (target: Record<string, any>, key: string) => {
  if (!activeEffect) {
    return;
  }
  let depsMap = bucket.get(target);
  if (!depsMap) {
    depsMap = new Map();
    bucket.set(target, depsMap);
  }
  let deps = depsMap.get(key);
  if (!deps) {
    deps = new Set();
    depsMap.set(key, deps);
  }
  deps.add(activeEffect);
  activeEffect.deps.push(deps);
};

const trigger = (target: Record<string, any>, key: string) => {
  const depsMap = bucket.get(target);
  if (depsMap) {
    const effects = depsMap.get(key);
    if (effects) {
      const effectsToRun: Set<EffectFunction> = new Set();
      effects.forEach(fn => {
        if (fn !== activeEffect) {
          effectsToRun.add(fn);
        }
      })
      effectsToRun.forEach(fn => fn());
    }
  }
};

const cleanup = (fn: EffectFunction) => {
  fn.deps.forEach(item => item.delete(fn));
  fn.deps.length = 0;
}

export const effect = (fn: Function) => {
  const effectFn = () => {
    cleanup(effectFn);
    activeEffect = effectFn;
    effectStack.push(effectFn);
    fn();
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1]
  }
  effectFn.deps = [] as Array<Set<EffectFunction>>;
  effectFn();
}