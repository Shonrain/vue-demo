import { VNode } from "./VNode";

export interface Container extends Element {
  oldVNode?: VNode | null
}