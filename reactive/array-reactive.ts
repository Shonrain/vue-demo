import { ITERATOR_KEY, TARGET_KEY } from './types/Key';
import { type EffectFunction } from './types/EffectFunction';
import { TRIGGER_TYPE } from './types/TriggerType';
import { ArrayInstrumentations } from './types/ArrayInstrumentations';

let activeEffect: EffectFunction | null = null;
const effectStack: Array<EffectFunction> = [];
const bucket: WeakMap<any, Map<string | symbol, Set<EffectFunction>>> = new WeakMap();
let shouldTrack = true;

// 重写查找数组的通用方法
const getSearchInstrumentation = (name: string) => {
  // 数组的原生方法
  const originMethod = Array.prototype[name];
  // 返回重写后的数组方法
  return function (...args: any) {
    // 调用数组的原生方法，这里的this为代理数据
    const res = originMethod.apply(this, args);
    // 如果在代理数据中没有找到，则通过this[TARGET_KEY]访问原始数据
    if (res === false || res < 0) {
      // 返回在原始数据中查找的结果
      return originMethod.apply(this[TARGET_KEY], args);
    }
    return res;
  }
};

// 重写数组栈操作的通用方法
const getStackInstrumentation = (name: string) => {
  // 数组的原生方法
  const originMethod = Array.prototype[name];
  // 返回重写后的数组方法
  return function(...args: any) {
    // 执行栈方法的时候不允许追踪
    shouldTrack = false;
    const res = originMethod.apply(this, args);
    // 执行完之后允许追踪
    shouldTrack = true;
    return res;
  }
}

const arrayInstrumentations: ArrayInstrumentations = {
  includes: getSearchInstrumentation('includes'),
  indexOf: getSearchInstrumentation('indexOf'),
  lastIndexOf: getSearchInstrumentation('lastIndexOf'),
  push: getStackInstrumentation('push'),
  pop: getStackInstrumentation('pop'),
  shift: getStackInstrumentation('shift'),
  unshift: getStackInstrumentation('unshift'),
  splice: getStackInstrumentation('splice')
};

const createReactive = (obj: any, isShallow = false, isReadOnly = false) => {
  return new Proxy(obj, {
    get(target: any, key: string | symbol, receiver: any) {
      // 当使用 TARGET_KEY 访问对象时，返回原始数据
      if (key === TARGET_KEY) {
        return target;
      }
      // 如果是数组且key以在arrayInstrumentations中存在，说明在调用我们重写的数组方法
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        // 从arrayInstrumentations返回相应的方法
        return Reflect.get(arrayInstrumentations, key, receiver);
      }

      // 非只读的时候才收集
      // 如果 key 的类型是 symbol，也不进行收集
      if (!isReadOnly && typeof key !== 'symbol') {
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
      track(target, Array.isArray(target) ? 'length' :ITERATOR_KEY);
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
      // 如果是数组，判断当前索引是否大于原数组的长度，如果大于则为新增，反之则是修改
      // 判断对象中是否有该属性，如果有，则本次操作为修改，反之则是新增
      const triggerType = Array.isArray(target) ? Number(key) >= target.length ? TRIGGER_TYPE.ADD : TRIGGER_TYPE.SET : target.hasOwnProperty(key) ? TRIGGER_TYPE.SET : TRIGGER_TYPE.ADD;
      const res = Reflect.set(target, key, value, receiver);
      // 相等说明 receiver 是 target 的代理对象
      if (target === receiver[TARGET_KEY]) {
        // 新旧值不一样才触发副作用函数执行
        // 处理NaN的情况
        if (oldValue !== value && (oldValue === oldValue || value === value)) {
          // 增加一个参数，将value传给trigger
          trigger(target, key, triggerType, value);
        }
      }
      return res;
    }
  });
}

// 深响应
const reactiveMap: Map<any, any> = new Map();

export const reactive = (obj: any) => {
  // 如果代理数据存在，则不重复创建
  let res = reactiveMap.get(obj);
  if (!res) {
    res = createReactive(obj);
    reactiveMap.set(obj, res);
  }
  return res;
}

// 浅响应
export const shallowReactive = (obj: any) => createReactive(obj, true);

// 深只读
export const readOnly = (obj: any) => createReactive(obj, false, true);

// 浅只读，第二个参数为 true
export const shallowReadOnly = (obj: any) => createReactive(obj, true, true);

const track = (target: any, key: string | symbol) => {
  // 禁止追踪，直接返回
  if (!activeEffect || !shouldTrack) {
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

const trigger = (target: any, key: string | symbol, triggerType: TRIGGER_TYPE, value?: any) => {
  const depsMap = bucket.get(target);
  if (depsMap) {
    const effectsToRun: Set<EffectFunction> = new Set();
    // 当修改了数组中的length属性
    if (Array.isArray(target) && key === 'length') {
      depsMap.forEach((effects: Set<EffectFunction>, key: string | symbol) => {
        // 修改length会导致index>=length的数组元素被删除，所以要触发响应
        if (typeof key === 'string' && key !== 'length' && Number(key) >= value) {
          effects.forEach(fn => {
            if (fn !== activeEffect) {
              effectsToRun.add(fn);
            }
          })
        }
      })
    }

    // 当给数组新增元素的时候需要触发length响应
    const lengthEffects = depsMap.get('length');
    if (lengthEffects && Array.isArray(target) && triggerType === TRIGGER_TYPE.ADD) {
      lengthEffects.forEach(fn => {
        if (fn !== activeEffect) {
          effectsToRun.add(fn);
        }
      })
    }

    // 当新增属性和删除属性的时候才触发副作用函数的执行
    // 取出 for...in 的副作用函数集合
    const iteratorEffects = depsMap.get(ITERATOR_KEY);
    if (iteratorEffects && (triggerType === TRIGGER_TYPE.ADD || triggerType === TRIGGER_TYPE.DELETE)) {
      iteratorEffects.forEach(fn => {
        if (fn !== activeEffect) {
          effectsToRun.add(fn);
        }
      })
    }

    const effects = depsMap.get(key);
    if (effects) {
      effects.forEach(fn => {
        if (fn !== activeEffect) {
          effectsToRun.add(fn);
        }
      })
    }

    effectsToRun.forEach(fn => fn());
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