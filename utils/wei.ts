import { BigNumber } from "ethers";

export function wei(value: TemplateStringsArray) {
  if (!value) {
    return "0";
  }
  const [amountText, unit = "wei"] = value[0]
    .replace(/_/g, "")
    .trim()
    .split(" ")
    .filter((v) => !!v);
  if (!Number.isFinite(+amountText)) {
    throw new Error(`Amount ${amountText} is not a number`);
  }

  switch (unit) {
    case "wei":
      return shiftDecimalPointsRight(amountText, 0);
    case "kwei":
      return shiftDecimalPointsRight(amountText, 3);
    case "mwei":
      return shiftDecimalPointsRight(amountText, 6);
    case "gwei":
      return shiftDecimalPointsRight(amountText, 9);
    case "microether":
      return shiftDecimalPointsRight(amountText, 12);
    case "milliether":
      return shiftDecimalPointsRight(amountText, 15);
    case "ether":
      return shiftDecimalPointsRight(amountText, 18);
    default:
      throw new Error(`Unknown unit "${unit}"`);
  }
}

wei.toBigNumber = (value: string) => {
  return BigNumber.from(value);
};

wei.fromBigNumber = (value: BigNumber) => {
  return value.toString();
};

function shiftDecimalPointsRight(number: string, shift: number) {
  const [integer, fraction = ""] = number.split(".");
  const leadingZeros = fraction.length === 0 ? 0 : fraction.length - 1;

  let result = integer === "0" ? "" : integer;

  for (let i = 0; i < shift; ++i) {
    result += fraction[i] || "0";
  }

  return result.slice(leadingZeros) || "0";
}
