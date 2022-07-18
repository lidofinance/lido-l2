import { BigNumberish } from "ethers";

const DELAY = 0;
const MAX_DELAY = 100;
const MIN_DELAY = 0;
const GRACE_PERIOD = 1000;

export function getBridgeExecutorParams(): [
  BigNumberish,
  BigNumberish,
  BigNumberish,
  BigNumberish
] {
  return [DELAY, GRACE_PERIOD, MIN_DELAY, MAX_DELAY];
}
