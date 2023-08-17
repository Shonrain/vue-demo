export interface CollectionInstrumentation {
  has: (value: any) => boolean,
  get: (isShallow: boolean) => (key: any) => any,
  forEach: (isShallow: boolean) => (callback: (key: any, value: any, target: any) => any, thisArg: any) => void,
  set: (key: any, value: any) => void,
  delete: (value: any) => boolean,
  clear: () => void,
  add: (value: any) => any,
  [Symbol.iterator]: () => any,
  entries: () => any,
  values: () => any,
  keys: () => any,
}


