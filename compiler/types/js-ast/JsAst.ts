export enum TYPE {
  FUNC = 'FUNC', // 方法
  STRING = 'STRING', // 文本
  ARRAY = "ARRAY", // 数组
  CALL = 'CALL', // 方法调用
  RETURN = 'RETURN', // 方法返回
}

export interface JsAst {
  type: TYPE,
  value?: string,
  params?: Array<JsAst>,
  body?: Array<JsAst>,
  arguments?: Array<JsAst>,
  elements?: Array<JsAst>,
  returnExpress?: JsAst,
}

export const newString = (value?: string): JsAst => ({
  type: TYPE.STRING,
  value,
});

export const newArray = (elements?: Array<JsAst>): JsAst => ({
  type: TYPE.ARRAY,
  elements,
});

export const newCall = (value?: string, args?: Array<JsAst>): JsAst => ({
  type: TYPE.CALL,
  value,
  arguments: args,
});

export const newReturn = (returnExpress?: JsAst): JsAst => ({
  type: TYPE.RETURN,
  returnExpress,
});

export const newFunc = (value: string, body: Array<JsAst>, params?: Array<JsAst>) => ({
  type: TYPE.FUNC,
  body,
  value,
  params,
});
