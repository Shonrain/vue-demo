import { TplAst } from '../tpl-ast/TplAst';

export class Context {
  currentNode: TplAst | null; // 当前节点

  childIndex: number; // 当前节点在父节点中的索引

  parent: TplAst | null; // 当前节点的父节点

  plugins: Array<(currentNode: TplAst, context: Context) => any>; // 插件方法

  constructor(
    currentNode: TplAst | null, 
    childIndex: number, 
    parent: TplAst | null, 
    plugins: Array<(currentNode: TplAst, context: Context) => any>
  ) {
    this.currentNode = currentNode;
    this.childIndex = childIndex;
    this.parent = parent;
    this.plugins = plugins;
  }

  // replaceNode = (node: TplAst | null) => {
  //   this.currentNode = node;
  //   if (this.parent && this.parent.children && node) {
  //     this.parent.children[this.childIndex] = node;
  //   }
  // }

  // removeCurrentNode = () => {
  //   if (this.parent) {
  //     if (this.parent.children) {
  //       this.parent.children.splice(this.childIndex, 1);
  //     }
  //     this.currentNode = null;
  //   }
  // }
}

export const newContext = (plugins: Array<(currentNode: TplAst, context: Context) => any>, currentNode = null, childIndex = 0, parent = null) => new Context(currentNode, childIndex, parent, plugins);