import { Context, newContext } from "./types/js-ast/Context";
import { TplAst } from "./types/tpl-ast/TplAst";

export const traverseNode = (ast: TplAst, context: Context) => {
  context.currentNode = ast;
  const exitFns: Array<() => any> = [];
  const plugins = context.plugins;
  // 收集退出时所要执行的方法
  plugins.forEach((fn) => {
    const onExit = fn(ast, context);
    if (onExit) {
      exitFns.push(onExit);
    }
  })
  const children = context.currentNode.children;
  if (children) {
    children.forEach((item: TplAst, index: number) => {
      context.parent = context.currentNode;
      context.childIndex = index;
      traverseNode(item, context);
    })
  }
  let i = exitFns.length;
  while(i--) {
    exitFns[i]();
  }
}

export const transform = (ast: TplAst, plugins: Array<(currentNode: TplAst, context: Context) => any>) => {
  const context = newContext(plugins);
  traverseNode(ast, context);
}