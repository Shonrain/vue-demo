// 遍历对象的绑定字段
export const ITERATOR_KEY = Symbol();

// receiver 通过该字段访问原始数据
export const TARGET_KEY = Symbol();

// Map 类型迭代key
export const MAP_ITERATOR_KEY = Symbol();

// 集合中标识clear操作的key
export const CLEAR_KEY = Symbol();