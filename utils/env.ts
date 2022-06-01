import dotenv from "dotenv";

dotenv.config();

export function getEnvVariable(variableName: string, defaultValue?: string) {
  const value = process.env[variableName];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(
      `Error: ENV variable ${variableName} is not set and default value wasn't provided`
    );
  }
  return (value || defaultValue) as string;
}
