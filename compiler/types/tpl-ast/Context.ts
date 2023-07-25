export enum MODE {
  DATA,
  RCDATA,
  RAWTEXT,
}

export class Context {
  source: string;

  mode: MODE;

  constructor(source: string, mode: MODE) {
    this.source = source;
    this.mode = mode;
  }

  // 消费字符
  consume = (num: number) => {
    this.source = this.source.slice(num);
  }

  // 消费空白字符
  consumeSpace = () => {
    const match = /^[\t\r\n\f\s ]*/.exec(this.source);
    if (match) {
      this.consume(match[0].length);
    }
  }
}

export const newContext = (source: string): Context => new Context(source, MODE.DATA);