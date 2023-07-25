export class Context {
  code: string;

  currentIndent: number;

  constructor(code: string, currentIndent: number) {
    this.code = code;
    this.currentIndent = currentIndent;
  }

  push = (code: string) => {
    this.code += code;
  }

  newLine = () => {
    this.code += '\n' + '  '.repeat(this.currentIndent);
  }

  indent = () => {
    this.currentIndent++;
    this.newLine();
  }

  deIndent = () => {
    this.currentIndent--;
    this.newLine();
  }
}

export const newContext = (code = '', currentIndent = 0) => new Context(code, currentIndent);