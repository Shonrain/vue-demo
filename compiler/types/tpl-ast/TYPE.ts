export enum TYPE {
  ROOT = "ROOT", // 根节点
  ELEMENT = "ELEMENT", // 标签节点
  COMMENT = "COMMENT", // 注释
  TEXT = "TEXT", // 文本
  INTERPOLATION = "INTERPOLATION", // 插值
  EXPRESSION = "EXPRESSION", // 表达式
  ATTRIBUTE = "ATTRIBUTE", // 属性
  DIRECTIVE = "DIRECTIVE" // 指令
}