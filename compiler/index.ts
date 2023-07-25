import { parse } from './parse';
import { transform } from './transform';
import { transformText, transRender, transformElement } from './plugins';
import { generate } from './generate';


export const compile = (str: string): string => {
  const tplAst = parse(str);
  const plugins = [transformText, transRender, transformElement];
  transform(tplAst, plugins);
  if (tplAst.jsNode) {
    return generate(tplAst.jsNode);
  }
  return '';
}