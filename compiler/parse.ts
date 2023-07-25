import { Context, MODE, newContext } from "./types/tpl-ast/Context";
import { TplAst } from "./types/tpl-ast/TplAst";
import { Props } from "./types/tpl-ast/Props";
import { TYPE } from "./types/tpl-ast/TYPE";

// 第一个参数为上下文对象，第二个参数为祖先节点所组成的数组
export const isEnd = (context :Context, ancestors: Array<TplAst>): boolean => {
  if (!context.source) {
    return true;
  }
  for(let i = ancestors.length - 1; i >= 0; --i) {
    // 匹配到结束节点</tag，只要祖先节点里面有可以与当前结束节点匹配的就结束
    if (context.source.startsWith(`</${ancestors[i].tag}`)) {
      return true;
    }
  }
  return false;
}

export const parseElement = (context: Context, ancestors: Array<TplAst>) => {
  const element = parseTag(context);
  if (element) {
    if (element.isSelfClosing) {
      return element;
    }
    if (element.tag === 'textarea' || element.tag === 'title') {
      context.mode = MODE.RCDATA;
    } else if (element.tag && /style|xmp|iframe|noembed|noframes|noscript/.test(element.tag)) {
      context.mode = MODE.RAWTEXT;
    } else {
      context.mode = MODE.DATA;
    }
    ancestors.push(element);
    element.children = parseChildren(context, ancestors);
    ancestors.pop();
    if (context.source.startsWith(`</${element.tag}`)) {
      parseTag(context, true);
    } else {
      console.error(`${element.tag} 标签缺少闭合标签`);
    }
  }
  return element;
}

export const parseProps = (context: Context): Array<Props> => {
  const { consume, consumeSpace } = context;
  const props: Array<Props>  = [];
  while(!context.source.startsWith('>') && !context.source.startsWith('/>')) {
    const matchName = /^[^\t\n\r\f />][^\t\n\r\f />=]*/.exec(context.source);
    if (matchName) {
      const name = matchName[0];
      consume(name.length);
      consumeSpace();
      // 消费等号
      consume(1);
      consumeSpace();
      let value = '';
      const quote = context.source[0];
      const isQuoted = quote === "'" || quote === '"';
      if (isQuoted) {
        consume(1);
        const endQuoteIndex = context.source.indexOf(quote);
        if (endQuoteIndex > -1) {
          value = context.source.slice(0, endQuoteIndex);
          consume(value.length);
          consume(1);
        } else {
          console.error('缺少引号')
        }
      } else {
        const matchValue = /^[^\t\n\r\f />]+/.exec(context.source);
        if (matchValue) {
          value = matchValue[0];
          consume(value.length);
        } else {
          console.error('不合法的属性值');
        }
      }
      consumeSpace();
      props.push({
        type: (name.startsWith('v-') || name.startsWith(':') || name.startsWith('@')) ? TYPE.DIRECTIVE : TYPE.ATTRIBUTE,
        name,
        value,
      })
    } else {
      console.error('不合法的属性名');
    }
  }
  return props;
}

export const parseTag = (context: Context, isEnd = false): TplAst | undefined => {
  const { consume, consumeSpace } = context;
  const match = isEnd ? /^<\/([a-z][^\t\n\r\f />]*)/i.exec(context.source) : /^<([a-z][^\t\n\r\f />]*)/i.exec(context.source);
  if (match) {
    const tag = match[1];
    consume(match[0].length);
    consumeSpace();
    const props = parseProps(context);
    const isSelfClosing = context.source.startsWith('/>');
    consume(isSelfClosing ? 2 : 1);
    consumeSpace();
    return {
      type: TYPE.ELEMENT,
      children: [],
      props,
      tag,
      isSelfClosing,
    } 
  }
  console.error('不合法的标签');
  return undefined;
}

export const parseComment = (context: Context): TplAst => {
  const { consume } = context;
  consume('<!--'.length);
  const closeIndex = context.source.indexOf('-->');
  if (closeIndex < 0) {
    console.error('缺少注释界定符');
  }
  const content = context.source.slice(0, closeIndex);
  consume(content.length);
  consume('-->'.length);
  return {
    type: TYPE.COMMENT,
    content,
  }
}

export const parseInterpolation = (context: Context): TplAst => {
  const { consume } = context;
  consume('{{'.length);
  const closeIndex = context.source.indexOf('}}');
  if (closeIndex < 0) {
    console.error('缺少插值界定符');
  }
  const content = context.source.slice(0, closeIndex);
  consume(content.length);
  consume('}}'.length);
  return {
    type: TYPE.INTERPOLATION,
    content: {
      type: TYPE.EXPRESSION,
      content,
    }
  }
}

export const parseText = (context: Context): TplAst => {
  const { consume } = context;
  let endIndex = context.source.length;
  const elementStartIndex = context.source.indexOf('<');
  const interpolationIndex = context.source.indexOf('{{');
  if (elementStartIndex > -1 && elementStartIndex < endIndex) {
    endIndex = elementStartIndex;
  }
  if (interpolationIndex > -1 && interpolationIndex < endIndex) {
    endIndex = interpolationIndex;
  }
  const content = context.source.slice(0, endIndex);
  consume(content.length);
  return {
    type: TYPE.TEXT,
    content,
  }
}

export const parseChildren = (context: Context, ancestors: Array<TplAst>): Array<TplAst> => {
  const nodes: Array<TplAst> = [];

  while(!isEnd(context, ancestors)) {
    let node;
    // DATA 模式和 RCDATA 模式下支持标签和插值节点的解析
    if (context.mode === MODE.DATA || context.mode === MODE.RCDATA) {
      const { mode, source } = context;
      // 解析标签
      if (mode === MODE.DATA && context.source[0] === '<') {
        if (source[1] === '!') {
          if (source.startsWith('<!--')) {
            // 解析注释节点
            node = parseComment(context);
          }
        } else if (source[1] === '/') {
          // 无效的结束标签
          console.error('无效的结束标签');
          continue;
        } else if (/[a-z]/i.test(source[1])) {
          // 解析标签节点
          node = parseElement(context, ancestors);
        }
      } else if (source.startsWith('{{')) {
        node = parseInterpolation(context);
      }
    }
    if (!node) {
      // 解析文本节点
      node = parseText(context);
    }

    // 解析完成的节点添加到节点数组中去
    nodes.push(node);
  }

  return nodes;
}

export const parse = (str: string): TplAst => {
  const context = newContext(str);
  const { consumeSpace } = context;
  consumeSpace();
  const nodes = parseChildren(context, []);
  return {
    type: TYPE.ROOT,
    children: nodes
  }
}