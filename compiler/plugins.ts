import { Context } from "./types/js-ast/Context";
import { TYPE as TPL_AST_TYPE } from './types/tpl-ast/TYPE';
import { TplAst } from "./types/tpl-ast/TplAst";
import { JsAst, newString, newArray, newCall, newReturn, newFunc } from './types/js-ast/JsAst';

export const transformText = (node: TplAst, context: Context) => {
  if (node.type == TPL_AST_TYPE.TEXT) {
    node.jsNode = newString(node.content as string | undefined);
  }
}

export const transformElement = (node: TplAst, context: Context) => {
  return () => {
    if (node.type === TPL_AST_TYPE.ELEMENT) {
      // h 方法的第一个参数，比如：h('div')
      const callExp = newCall('h', [newString(node.tag)]);
      if (node.children) {
        if (node.children.length === 1) {
          if (node.children[0] && node.children[0].jsNode) {
            callExp.arguments ? callExp.arguments.push(node.children[0].jsNode) : callExp.arguments = [node.children[0].jsNode];
          }
        } else {
          const args = node.children.map(item => item.jsNode).filter(_ => _) as Array<JsAst>;
          callExp.arguments ? callExp.arguments.push(newArray(args)) : callExp.arguments = [newArray(args)];
        }
      }
      node.jsNode = callExp;
    }
  }
}

export const transRender = (node: TplAst, context: Context) => {
  return () => {
    if (node.type === TPL_AST_TYPE.ROOT) {
      if (node.children) {
        const jsAst = node.children[0].jsNode;
        const body = newReturn(jsAst);
        node.jsNode = newFunc('render', [body])
      }
    }
  }
}