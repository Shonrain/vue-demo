import { reactive } from './collection-reactive';

export const ref = (value: any) => {
  // 创建一个包裹对象
  const wrapper = { value }
  // 添加一个不可枚举且不可修改的属性，用来标识该对象是通过 ref 包裹的
  Object.defineProperty(wrapper, '__v_isRef', {
    value: true
  });
  return reactive(wrapper);
}

export const toRef = (target: any, key: string) => {
  const wrapper = {
    // getter
    get value() {
      return target[key];
    },
    // setter
    set value(val: any) {
      target[key] = val;
    }
  }
  Object.defineProperty(wrapper, '__v_isRef', {
    value: true
  });
  return wrapper;
}

export const toRefs = (target: any) => {
  const refs = {};
  for(const key in target) {
    refs[key] = toRef(target, key);
  }
  return refs;
}

export const proxyRefs = (target: any) => {
  return new Proxy(target, {
    get(target: any, key: string | symbol, receiver: any) {
      const value = Reflect.get(target, key, receiver);
      // 判断是否是ref，如果是则脱落ref
      return value.__v_isRef ? value.value : value;
    },
    set(target: any, key: string | symbol, newValue: any, receiver: any) {
      const value = target[key];
      // 如果是 ref，则修改 ref 的 value
      if (value.__v_isRef) {
        value.value = newValue;
        return true
      }
      return Reflect.set(target, key, newValue, receiver);
    }
  })
}