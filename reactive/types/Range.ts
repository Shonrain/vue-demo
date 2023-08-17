export class Range {
  value: number;

  stop: number;

  constructor(start: number, stop: number) {
    if (start <= stop) {
      this.value = start;
      this.stop = stop;
    } else {
      this.value = 0;
      this.stop = 0;
    }
  }

  next = () => {
    let value = this.value;
    if (value < this.stop) {
      this.value++;
      return {
        done: false, 
        value: value
      };
    }
    return {
      done: true,
      value: undefined
    };
  }

  [Symbol.iterator] = () => ({
    next: this.next
  })
}

export const newRange = (start: number, stop: number) => new Range(start, stop);