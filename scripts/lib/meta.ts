import { State, persistMetadataState, readMetadataState } from "./persist-metadata"

class MetaData {
  private network: string
  private baseName: string
  private dir: string
  private meta: State

  constructor(network: string, baseName = "deployed", dir = "./") {
    this.network = network
    this.baseName = baseName
    this.dir = dir
    this.meta = {}
  }

  read() {
    this.meta = readMetadataState(this.network, this.baseName, this.dir)
    return this.meta
  }

  write(meta: State) {
    persistMetadataState(this.network, this.meta, meta, this.baseName, this.dir)
  }
}

function init(network: string, deployedBaseName: string | undefined = undefined, deployedDir: string | undefined = undefined) {
  return new MetaData(network, deployedBaseName, deployedDir)
}

export default init