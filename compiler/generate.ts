import { JsAst, TYPE } from './types/js-ast/JsAst';
import { Context, newContext } from './types/code/Context';

const geneNodeList = (nodes: Array<JsAst>, context: Context) => {
  const { push } = context;
  nodes.forEach((n: JsAst, index: number) => {
    geneNode(n, context);
    if (index < nodes.length - 1) {
      push(', ');
    }
  })
}

const geneFuc = (node: JsAst, context: Context) => {
  const { push, indent, deIndent } = context;
  push(`function ${node.value}(`);
  if (node.params) {
    geneNodeList(node.params, context);
  }
  push(') {');
  indent();
  if (node.body) {
    node.body.forEach((b: JsAst) => geneNode(b, context));
  }
  deIndent();
  push('}')
};

const geneReturn = (node: JsAst, context: Context) => {
  const { push } = context;
  push('return ');
  if (node.returnExpress) {
    geneNode(node.returnExpress, context);
  }
}

const geneCall = (node: JsAst, context: Context) => {
  const { push } = context;
  const { value, arguments: args } = node;
  if (value) {
    push(`${value}(`);
    if (args) {
      geneNodeList(args, context);
    }
    push(')');
  }
}

const geneString = (node: JsAst, context: Context) => {
  const { push } = context;
  push(`'${node.value}'`);
}

const geneArray = (node: JsAst, context: Context) => {
  const { push } = context;
  push('[')
  if (node.elements) {
    geneNodeList(node.elements, context);
  }
  push(']')
}

export const geneNode = (node: JsAst, context: Context) => {
  switch(node.type) {
    case TYPE.FUNC: geneFuc(node, context); break;
    case TYPE.RETURN: geneReturn(node, context); break;
    case TYPE.CALL: geneCall(node, context); break;
    case TYPE.STRING: geneString(node, context); break;
    case TYPE.ARRAY: geneArray(node, context); break;
  }
};

export const generate = (node: JsAst): string => {
  const context = newContext();
  geneNode(node, context);
  return context.code;
}