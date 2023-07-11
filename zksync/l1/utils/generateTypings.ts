import { runTypeChain, glob } from "typechain";

async function main() {
  const cwd = process.cwd();
  console.log(cwd);
  // find all files matching the glob
  const allFiles = glob(cwd, [
    `!./artifacts/!(build-info)/**/*.dbg.json`,
    `./artifacts/!(build-info)/**/+([a-zA-Z0-9_]).json`,
  ]);

  const result = await runTypeChain({
    cwd,
    filesToProcess: allFiles,
    allFiles,
    outDir: "./typechain",
    target: "ethers-v5",
  });

  console.log(result);
}

main().catch(console.error);
