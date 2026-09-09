import { isTauri } from "./platform";

export async function ffmpegAvailable(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<boolean>("ffmpeg_available");
  } catch {
    return false;
  }
}

export async function transcodeToMp4(blob: Blob): Promise<Blob> {
  const { invoke } = await import("@tauri-apps/api/core");
  const { writeFile, readFile, remove } = await import("@tauri-apps/plugin-fs");
  const { tempDir, join } = await import("@tauri-apps/api/path");
  const dir = await tempDir();
  const stamp = Date.now();
  const src = await join(dir, `ve-${stamp}.webm`);
  const dst = await join(dir, `ve-${stamp}.mp4`);
  await writeFile(src, new Uint8Array(await blob.arrayBuffer()));
  try {
    await invoke("ffmpeg_transcode", { src, dst });
    const out = await readFile(dst);
    const copy = new Uint8Array(out.byteLength);
    copy.set(out);
    return new Blob([copy], { type: "video/mp4" });
  } finally {
    await remove(src).catch(() => undefined);
    await remove(dst).catch(() => undefined);
  }
}
