import { TYPE, VNode } from "./types/VNode"
import { Container } from "./types/Container";

const patchProps = (el: Element, key: string, newValue: string | null) => {
  if (!newValue) {
    el.removeAttribute(key);
  } else if (typeof newValue === 'string') {
    el.setAttribute(key, newValue);
  }
};

const mountElement = (node: VNode, container: Container) => {
  // 挂载DOM元素
  if (node.type === TYPE.ELEMENT) {
    if (!node.tag) return;
    const element: Container = document.createElement(node.tag);
    // 将真实DOM与虚拟DOM相关联
    node.el = element;
    if (node.props && node.el) {
      for(const key in node.props) {
        patchProps(node.el as Element, key, node.props[key])
      }
    }
    // 挂载子节点
    if (node.children) {
      node.children.forEach(child => mountElement(child, element));
    }
    container.appendChild(element);
  } else if (node.type === TYPE.COMMENT) {
    // 挂载注释
    const comment = node.content ? node.content : '';
    const commentNode = document.createComment(comment);
    node.el = commentNode;
    container.appendChild(commentNode);
  } else if (node.type === TYPE.TEXT) {
    // 挂载文本
    const text = node.content ? node.content : '';
    const textNode = document.createTextNode(text);
    node.el = textNode;
    container.appendChild(textNode);
  }
};

const patchElement = (oldVNode: VNode, newVNode: VNode, container: Container) => {
  unmount(oldVNode);
  mountElement(newVNode, container);
};

const unmount = (vNode: VNode) => {
  const el = vNode.el;
  if (!el) return;
  if (vNode.children && vNode.children.length > 0) {
    vNode.children.forEach((child: VNode) => unmount(child));
  }  
  const parent = el.parentNode;
  if (parent) {
    parent.removeChild(el);
  }
};

const patch = (oldVNode: VNode | null | undefined, newVNode: VNode, container: Container) => {
  if (!oldVNode) {
    // 旧节点不存在，说明是挂载操作
    mountElement(newVNode, container);
  } else {
    // 新旧节点都存在，需要进行更新操作
    patchElement(oldVNode, newVNode, container);
  }
};

export const render = (vNode: VNode | null, idSelector: string) => {
  const container: Container | null = document.querySelector(idSelector);
  if (!container) return;
  if (vNode) {
    // 挂载或者更新
    patch(container.oldVNode, vNode, container);
  } else if (container.oldVNode) {
    // 卸载操作
    unmount(container.oldVNode);
  }
  // 将旧的虚拟DOM存储在container中
  container.oldVNode = vNode;
};