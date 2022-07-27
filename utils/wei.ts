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
  const [integerPart, fractionPart = ""] = number.split(".");
  const totalLength = integerPart.length + shift;

  // Example: 12,0001 kwei must be 12000 wei
  // 1. remove floating point -> 120001
  // 2. add missing zeros -> 120001
  // 3. substring the result 12000
  // 4. remove leading zeros 12000

  // Example: 0.01 kwei must be 10
  // 1. remove floating point -> 001
  // 2. add missing zeros -> 0010
  // 3. substring the result -> 0010
  // 4. remove leading zeros -> 10
  return removeLeadingZeros(
    (integerPart + fractionPart)
      .padEnd(totalLength, "0")
      .substring(0, totalLength)
  );
}

function removeLeadingZeros(value: string) {
  let leadingZerosCount = 0;
  while (leadingZerosCount < value.length && value[leadingZerosCount] === "0") {
    leadingZerosCount += 1;
  }
  return value.substring(leadingZerosCount) || "0";
}
