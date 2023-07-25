import { TYPE } from './TYPE';

export interface Props {
  type: TYPE.ATTRIBUTE | TYPE.DIRECTIVE,
  name: string,
  value: string,
}