// Records the sample AI interview answers in assets/sample-ai-interview/ —
// each dummy transcript (src/lib/dummy-ai-interviews.ts) read aloud by a
// macOS voice, so the dummy reports' recordings say exactly what their
// transcripts do. Run once on a Mac after changing a transcript:
//   node_modules/.bin/tsx scripts/generate-dummy-ai-interview-audio.ts
// The clips (and durations.json) are committed, so nothing else needs this.
import { execFileSync } from "child_process";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import ffmpegPath from "ffmpeg-static";
import { DUMMY_AI_INTERVIEWS, dummyClipName } from "../src/lib/dummy-ai-interviews";

const OUT_DIR = path.join(process.cwd(), "assets", "sample-ai-interview");
const ffmpeg = process.env.FFMPEG_BIN || (ffmpegPath as unknown as string);

mkdirSync(OUT_DIR, { recursive: true });
const durations: Record<string, number> = {};

for (const interview of DUMMY_AI_INTERVIEWS) {
  if (!interview.clipKey || !interview.voice) continue;
  interview.answers.forEach((answer, index) => {
    const name = dummyClipName(interview.clipKey!, index + 1);
    const aiff = path.join(os.tmpdir(), `${name}.aiff`);
    execFileSync("say", ["-v", interview.voice!, "-r", "170", "-o", aiff, answer.transcript]);
    // Same format real answers are saved in (AAC in .m4a, mono).
    execFileSync(
      ffmpeg,
      ["-hide_banner", "-y", "-i", aiff, "-c:a", "aac", "-b:a", "48k", "-ac", "1", "-movflags", "+faststart", path.join(OUT_DIR, name)],
      { stdio: "ignore" },
    );
    rmSync(aiff, { force: true });

    // `ffmpeg -i` with no output prints the duration and exits non-zero.
    let stderr = "";
    try {
      execFileSync(ffmpeg, ["-hide_banner", "-i", path.join(OUT_DIR, name)], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
    } catch (err) {
      stderr = String((err as { stderr?: string }).stderr ?? "");
    }
    const match = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
    const seconds = match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : 0;
    durations[name] = Math.max(1, Math.round(seconds));
    console.log(`${name}  ${durations[name]}s`);
  });
}

writeFileSync(path.join(OUT_DIR, "durations.json"), JSON.stringify(durations, null, 2) + "\n");
