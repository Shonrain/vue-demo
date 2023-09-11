export enum TYPE {
  ELEMENT = 'ELEMENT',
  TEXT = 'TEXT',
  COMMENT = 'COMMENT'
}

export interface VNode {
  type: TYPE,
  tag?: string,
  content?: string,
  children?: Array<VNode>,
  props?: Record<string, string | null>,
  el?: Node,
}