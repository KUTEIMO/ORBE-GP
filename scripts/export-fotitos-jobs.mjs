import { DRIVE_FOTITOS_SRC, FOTITOS_SCENES } from "./fotitos-catalog.mjs";

const copies = FOTITOS_SCENES.map((s) => ({
  fileKey: s.fileKey,
  dstRel: `media/unisimoncucuta/${s.tourSlug}/panoramas/${s.fileKey}`,
}));

/** @type {Array<{ slug: string, text: string, mp3Rel: string, vttRel: string, txtRel: string, timingRel: string }>} */
const jobs = [];

for (const s of FOTITOS_SCENES) {
  const base = `media/unisimoncucuta/${s.tourSlug}/assets`;
  jobs.push({
    slug: `scene:${s.tourSlug}/${s.slug}`,
    text: s.ttsScript,
    mp3Rel: `${base}/audio/scenes/${s.slug}.mp3`,
    vttRel: `${base}/captions/scenes/${s.slug}.vtt`,
    txtRel: `${base}/transcripts/scenes/${s.slug}.txt`,
    timingRel: `${base}/accessibility/timing/scenes/${s.slug}.json`,
    scriptRel: `${base}/accessibility/scripts/scenes/${s.slug}.md`,
    title: s.title,
  });
  for (const h of s.infoHotspots || []) {
    jobs.push({
      slug: `hotspot:${s.tourSlug}/${h.id}`,
      text: h.ttsScript,
      mp3Rel: `${base}/audio/hotspots/${h.id}.mp3`,
      vttRel: `${base}/captions/hotspots/${h.id}.vtt`,
      txtRel: `${base}/transcripts/hotspots/${h.id}.txt`,
      timingRel: `${base}/accessibility/timing/hotspots/${h.id}.json`,
      scriptRel: `${base}/accessibility/scripts/hotspots/${h.id}.md`,
      title: h.title,
    });
  }
}

process.stdout.write(
  JSON.stringify(
    {
      srcDir: DRIVE_FOTITOS_SRC,
      copies,
      jobs,
    },
    null,
    2
  )
);

