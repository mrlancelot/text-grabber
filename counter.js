export async function nextFilename(dirHandle) {
  let max = 0;
  for await (const name of dirHandle.keys()) {
    const match = /^(\d+)\.txt$/.exec(name);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${max + 1}.txt`;
}
