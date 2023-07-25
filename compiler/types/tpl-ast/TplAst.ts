import { Props } from "./Props";
import { TYPE } from './TYPE';
import { Content } from "./Content";
import { JsAst } from "../js-ast/JsAst";

export interface TplAst {
  type: TYPE,
  tag?: string,
  isSelfClosing?: boolean,
  props?: Array<Props>,
  content?: string | Content,
  children?: Array<TplAst>,
  jsNode?: JsAst,
}