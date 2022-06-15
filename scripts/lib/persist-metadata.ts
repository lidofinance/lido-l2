import { existsSync, readFileSync, writeFileSync } from "fs"
import { resolve } from "path"
import log from "./log"

const METADATA_FILE_BASENAME = process.env.METADATA_FILE_BASENAME || "metadata"
const METADATA_FILE_DIR = process.env.METADATA_FILE_DIR || "./"

export interface State {
  [key: string]: any
}
export function readMetadataState(netName: string, basename: string, dir: string): State {
  const fileName = _getFileName(netName, basename, dir)
  log(`Reading state from ${fileName}...`)
  const state = _readMetadataStateFile(fileName)
  return state
}

export function persistMetadataState(netName: string, state: State, updates: State | null = null, basename: string, dir: string) {
  if (updates) {
    updateMetadataState(state, updates)
  }
  const fileName = _getFileName(netName, basename, dir)
  log(`Writing state to ${fileName}...`)
  _writeMetadataStateFile(fileName, state)
}

export function updateMetadataState(state: State, newState: State) {
  Object.keys(newState).forEach((key) => {
    const value = newState[key]
    if (value != null) {
      state[key] = value
    }
  })
}

function _getFileName(netName: string, baseName = METADATA_FILE_BASENAME, dir: string = METADATA_FILE_DIR): string {
  return resolve(dir, `${baseName}-${netName}.json`)
}

function _readMetadataStateFile(fileName: string): State {
  if (!existsSync(fileName)) {
    const state = {}
    _writeMetadataStateFile(fileName, state)
    return state
  }
  const data = readFileSync(fileName, "utf8")
  try {
    return JSON.parse(data)
  } catch (err: any) {
    throw new Error(`malformed Metadata state file ${fileName}: ${err.message}`)
  }
}

function _writeMetadataStateFile(fileName: string, state: State) {
  const data = JSON.stringify(state, null, "  ")
  writeFileSync(fileName, data + "\n", "utf8")
}