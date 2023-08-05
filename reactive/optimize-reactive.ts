type EffectFunction = {
  (): void,
  deps: Array<Set<EffectFunction>>
}

// 触发副作用函数执行的类型
enum TRIGGER_TYPE {
  SET = 'SET', // 修改
  ADD = 'ADD', // 增加
  DELETE = 'DELETE', // 删除
}

let activeEffect: EffectFunction | null = null;
const effectStack: Array<EffectFunction> = [];
const bucket: WeakMap<any, Map<string | symbol, Set<EffectFunction>>> = new WeakMap();
// 遍历对象的绑定字段
const ITERATOR_KEY = Symbol();
// receiver 通过该字段访问原始数据
const TARGET_KEY = Symbol();

const createReactive = (obj: any, isShallow = false, isReadOnly = false) => {
  return new Proxy(obj, {
    get(target: any, key: string | symbol, receiver: any) {
      // 当使用 TARGET_KEY 访问对象时，返回原始数据
      if (key === TARGET_KEY) {
        return target;
      }
      // 非只读的时候才收集
      if (!isReadOnly) {
        track(target, key);
      }
      const res = Reflect.get(target, key, receiver);
      // 浅响应或浅只读直接返回
      if (isShallow) {
        return res;
      }
      if (res && typeof res === 'object') {
        // 深只读和深响应递归调用相应函数
        return isReadOnly ? readOnly(res): reactive(res);
      }
      return res
    },
    // 拦截 in 操作
    has(target: any, key: string) {
      track(target, key);
      return Reflect.has(target, key);
    },
    // 拦截 for...in 操作
    ownKeys(target: any) {
      // 通过 ITERATOR_KEY 作为副作用函数的关联key
      track(target, ITERATOR_KEY);
      return Reflect.ownKeys(target);
    },
    // 拦截删除操作
    deleteProperty(target: any, key: string) {
      if (isReadOnly) {
        console.warn(`属性 ${key} 是只读的`)
        return true;
      }
      // 判断对象中是否有该属性
      const hasKey = target.hasOwnProperty(key);
      // 删除操作
      const res = Reflect.deleteProperty(target, key);
      // 如果删除成功且对象中有该属性，则触发副作用函数
      if (hasKey && res) {
        trigger(target, key, TRIGGER_TYPE.DELETE);
      }
      return res;
    },
    set(target: any, key: string, value: any, receiver: any) {
      if (isReadOnly) {
        console.warn(`属性 ${key} 是只读的`)
        return true;
      }
      // 旧值
      const oldValue = target[key];
      // 判断对象中是否有该属性
      // 如果有，则本次操作为修改属性值
      // 如果没有，则本次操作为增加新的属性
      const triggerType = target.hasOwnProperty(key) ? TRIGGER_TYPE.SET : TRIGGER_TYPE.ADD;
      const res = Reflect.set(target, key, value, receiver);
      // 相等说明 receiver 是 target 的代理对象
      if (target === receiver[TARGET_KEY]) {
        // 新旧值不一样才触发副作用函数执行
        // 处理NaN的情况
        if (oldValue !== value && (oldValue === oldValue || value === value)) {
          trigger(target, key, triggerType);
        }
      }
      return res;
    }
  });
}

// 深响应
export const reactive = (obj: any) => createReactive(obj);

// 浅响应
export const shallowReactive = (obj: any) => createReactive(obj, true);

// 深只读
export const readOnly = (obj: any) => createReactive(obj, false, true);

// 浅只读，第二个参数为 true
export const shallowReadOnly = (obj: any) => createReactive(obj, true, true);

const track = (target: any, key: string | symbol) => {
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

const trigger = (target: any, key: string | symbol, triggerType: TRIGGER_TYPE) => {
  const depsMap = bucket.get(target);
  if (depsMap) {
    const effects = depsMap.get(key);
    // 取出 for...in 的副作用函数集合
    const iteratorEffects = depsMap.get(ITERATOR_KEY);
    // 当 新增属性和删除属性的时候才触发副作用函数的执行
    if (iteratorEffects && (triggerType === TRIGGER_TYPE.ADD || triggerType === TRIGGER_TYPE.DELETE)) {
      const effectsToRun: Set<EffectFunction> = new Set();
      iteratorEffects.forEach(fn => {
        if (fn !== activeEffect) {
          effectsToRun.add(fn);
        }
      })
      effectsToRun.forEach(fn => fn());
    }
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