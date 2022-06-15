import chalk from "chalk"

export const yl = (s: string | number) => chalk.yellow(s)
export const gr = (s: string | number) => chalk.green(s)
export const rd = (s: string | number) => chalk.red(s)
export const wt = (s: string | number) => chalk.white(s)
const LOG = wt("➤")
const INFO = gr("✓")
const ERROR = rd("×")
const WARN = yl("⚠")

export const log = (...args: any) => console.log(LOG, ...args)

log.i = (...args: any) => {
  console.info(INFO, ...args)
}

log.e = (...args: any) => {
  console.error(ERROR, ...args)
}

log.w = (...args: any) => {
  console.warn(WARN, ...args)
}

log.split = (...args: any) => {
  if (args.length) {
    log(...args)
  }
  console.log("====================")
}

export default log
