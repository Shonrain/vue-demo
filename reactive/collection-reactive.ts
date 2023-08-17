import { ITERATOR_KEY, TARGET_KEY, MAP_ITERATOR_KEY, CLEAR_KEY } from './types/Key';
import { type EffectFunction } from './types/EffectFunction';
import { TRIGGER_TYPE } from './types/TriggerType';
import { ArrayInstrumentations } from './types/ArrayInstrumentations';
import { CollectionInstrumentation } from './types/CollectionInstrumentation';

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

// 重写集合 has 方法
const collectionHasInstrumentation = () => {
  return function(value: any) {
    // 获取原始数据，也就是集合本身
    const target = this[TARGET_KEY];
    // 调用原生的 has 方法
    const res = target.has(value);
    // 收集副作用函数
    track(target, value);
    // 返回结果
    return res;
  }
}

// 重写集合的 get 方法，该方法接收一个参数用来判断是否是深响应
const collectionGetInstrumentation = (isShallow = false) => {
  return function(key: any) {
    // 获取原始数据，也就是集合本身
    const target = this[TARGET_KEY];
    // 调用原生的 get 方法
    const res = target.get(key);
    // 收集依赖
    track(target, key);
    // 如果是浅响应，直接返回结果
    if (isShallow) {
      return res;
    }
    // 如果是深响应，递归调用 reactive
    return typeof res === 'object' ? reactive(res) : res;
  }
}

// 对数据进行响应式处理
const wrap = (target: any, isShallow = false) => {
  // 浅响应直接返回
  if (isShallow) {
    return target;
  }
  // 如果是对象则通过 reactive 方法封装
  return typeof target === 'object' ? reactive(target) : target
}

// 重写 forEach
const collectionForEachInstrumentation = (isShallow = false) => {
  return function(callback: (key: any, value: any, target: any) => any, thisArg: any) {
    // 获取原始数据，也就是集合本身
    const target = this[TARGET_KEY];
    // 收集依赖，size 改变的时候应该触发 forEach 的响应
    track(target, ITERATOR_KEY);
    target.forEach((value: any, key: any) => {
      // 通过call来调用callback，这样可以指定this值
      callback.call(thisArg, wrap(value, isShallow), wrap(key, isShallow), this)
    });
  }
}

// 重写set方法
const collectionSetInstrumentation = () => {
  return function(key: any, value: any) {
    // 获取原始数据，也就是集合本身
    const target = this[TARGET_KEY];
    // map 中是否有含有该key的键值对
    const hasKey = target.has(key);
    const oldValue = target.get(key);
    // 修改原始值的时候使用原始数据
    const targetValue = value[TARGET_KEY] || value;
    target.set(key, targetValue);
    if (!hasKey) {
      trigger(target, key, TRIGGER_TYPE.ADD, value);
      // 新旧值比较
    } else if (oldValue !== value && (oldValue === oldValue || value === value)) {
      trigger(target, key, TRIGGER_TYPE.SET, value);
    }        
  }
}

// 重写 delete 方法
const collectionDeleteInstrumentation = () => {
  return function(value: any) {
    // 获取原始数据，也就是集合本身
    const target = this[TARGET_KEY];
    // 先判断集合中是否有该值，然后进行删除
    if (target.has(value)) {
      // 调用集合原生的 delete 方法进行删除
      const res = target.delete(value);
      trigger(target, value, TRIGGER_TYPE.DELETE);
      return res;
    }
    return false;
  }
}

// 重写 clear 方法
const collectionClearInstrumentation = () => {
  return function() {
    // 获取原始数据，也就是集合本身
    const target = this[TARGET_KEY];
    target.clear();
    trigger(target, CLEAR_KEY, TRIGGER_TYPE.DELETE);
  }
}

// 重写 add 方法
const collectionAddInstrumentation = () => {
  return function(value: any) {
    // 获取原始数据，也就是集合本身
    const target = this[TARGET_KEY];
    // 判断是否有该值
    const hasValue = target.has(value);
    // 修改原始值的时候使用原始数据
    const targetValue = value[TARGET_KEY] || value;
    const res = target.add(targetValue)
    // 如果集合中不存在该值，则触发响应
    if (!hasValue) {
      trigger(target, value, TRIGGER_TYPE.ADD);
    }
    return res;
  }
}

// 重写迭代器
const collectionIteratorInstrumentation = () => {
  return function() {
    // 获取原始数据，也就是集合本身
    const target = this[TARGET_KEY];
    // 调用原生的迭代器
    const itr = target[Symbol.iterator]();
    // 收集
    track(target, ITERATOR_KEY);
    return {
      // 重写 next 方法
      next() {
        // 调用原生的 next 方法
        const { value, done } = itr.next();
        let wrapValue = wrap(value);
        // 如果是 Map 类型
        if (isMap(target)) {
          wrapValue = value ? [wrap(value[0]), wrap(value[1])] : value;
        }
        return {
          value: wrapValue,
          done,
        }
      },
      [Symbol.iterator]() {
        return this;
      }
    }
  }
}

// 重写 keys 和 values 方法，该方法接收一个参数，用来标识是否是 keys
const collectionKeysOrValuesInstrumentation = (isKeys = false) => {
  return function() {
    // 获取原始数据，也就是集合本身
    const target = this[TARGET_KEY];
    // 调用原生的 values
    let itr = target.values();
    // 如果是 keys，则调用原生的 keys 方法
    if (isKeys) {
      itr = target.keys();
    }    
    if (isMap(target) && isKeys) {
      // Map 类型有专门的 key
      track(target, MAP_ITERATOR_KEY);
    } else {
      track(target, ITERATOR_KEY);
    }    
    return {
      next() {
        const { value, done } = itr.next();
        return {
          value: wrap(value),
          done,
        }
      },
      [Symbol.iterator]() {
        return this;
      }
    }
  }
}

const collectionInstrumentation: CollectionInstrumentation = {
  has: collectionHasInstrumentation(),
  get: (isShallow = false) => collectionGetInstrumentation(isShallow),
  forEach: (isShallow = false) => collectionForEachInstrumentation(isShallow),
  set: collectionSetInstrumentation(),
  delete: collectionDeleteInstrumentation(),
  clear: collectionClearInstrumentation(),
  add: collectionAddInstrumentation(),
  [Symbol.iterator]: collectionIteratorInstrumentation(),
  entries: collectionIteratorInstrumentation(),
  keys: collectionKeysOrValuesInstrumentation(true),
  values: collectionKeysOrValuesInstrumentation()
}

const getCollectionType = (target: any) => Object.prototype.toString.call(target);

// 判断是否是 Map 类型
const isMap = (target: any) => getCollectionType(target) === '[object Map]' || getCollectionType(target) === '[object WeakMap]';

// 判断是否是 Set 类型
const isSet = (target: any) => getCollectionType(target) === '[object Set]' || getCollectionType(target) === '[object WeakSet]';

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

      // 代理集合类型
      if ((isMap(target) || isSet(target))) {
        // 访问 size 属性
        if (key === 'size') {
          // 与 ITERATOR_KEY 建立绑定关系，防止出现 `data.get('size')`，导致误收集
          track(target, ITERATOR_KEY);
          return Reflect.get(target, key, target);
        }
        // get、forEach 方法需要考虑深响应和浅响应
        if ((key === 'get' && isMap(target)) || key === 'forEach') {
          return collectionInstrumentation[key](isShallow);
        }

        // 由于我们重写了集合中的所有方法，所以直接从collectionInstrumentation中返回
        return Reflect.get(collectionInstrumentation, key, receiver);
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
      track(target, Array.isArray(target) ? 'length' : ITERATOR_KEY);
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
      const targetValue = value[TARGET_KEY] || value;
      // 修改原始值的时候使用原始数据
      const res = Reflect.set(target, key, targetValue, receiver);
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

    // 当执行了集合中的clear操作时
    if((isMap(target) || isSet(target)) && key === CLEAR_KEY) {
      depsMap.forEach((effects: Set<EffectFunction>) => {
        // 执行clear之后集合中所有的元素都被清空了，所以需要触发与每个元素相关联的副作用函数的执行
        effects.forEach(fn => {
          if (fn !== activeEffect) {
            effectsToRun.add(fn);
          }
        })
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
    // 如果数据类型是 Map，SET操作也应该执行副作用函数
    const iteratorEffects = depsMap.get(ITERATOR_KEY);
    if (iteratorEffects && 
        (triggerType === TRIGGER_TYPE.ADD || 
          triggerType === TRIGGER_TYPE.DELETE || 
          (triggerType === TRIGGER_TYPE.SET && isMap(target)))) {
      iteratorEffects.forEach(fn => {
        if (fn !== activeEffect) {
          effectsToRun.add(fn);
        }
      })
    }

    // 如果是 Map 数据类型，取出与 MAP_ITERATOR_KEY 关联的副作用执行
    const mapKeyIteratorEffects = depsMap.get(MAP_ITERATOR_KEY);
    if (isMap(target) && mapKeyIteratorEffects && (triggerType === TRIGGER_TYPE.ADD || triggerType === TRIGGER_TYPE.DELETE)) {
      mapKeyIteratorEffects.forEach(fn => {
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