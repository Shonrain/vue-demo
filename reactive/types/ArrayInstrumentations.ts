export interface ArrayInstrumentations {
  includes: (...args: Array<any>) => any,
  indexOf: (...args: Array<any>) => any,
  lastIndexOf: (...args: Array<any>) => any,
  push: (...args: Array<any>) => any,
  pop: (...args: Array<any>) => any,
  shift: (...args: Array<any>) => any,
  unshift: (...args: Array<any>) => any,
  splice: (...args: Array<any>) => any
}