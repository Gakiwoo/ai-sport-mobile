const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'docs', 'testing', 'video-dataset-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const strict = process.argv.includes('--strict');

const coverageTotal = manifest.coverage.reduce((sum, item) => sum + item.requiredCount, 0);
if (coverageTotal !== manifest.requiredTotal) {
  throw new Error(
    `Coverage total ${coverageTotal} does not match requiredTotal ${manifest.requiredTotal}`,
  );
}

const counts = new Map(manifest.coverage.map((item) => [item.exerciseType, 0]));
const statusOrder = new Set(manifest.statusOrder);
const ids = new Set();

for (const video of manifest.videos) {
  if (!video.id || ids.has(video.id)) {
    throw new Error(`Missing or duplicated video id: ${video.id || '<empty>'}`);
  }
  ids.add(video.id);

  if (!counts.has(video.exerciseType)) {
    throw new Error(`Unknown exerciseType for ${video.id}: ${video.exerciseType}`);
  }
  if (!statusOrder.has(video.status)) {
    throw new Error(`Invalid status for ${video.id}: ${video.status}`);
  }
  if (!video.path) {
    throw new Error(`Missing path for ${video.id}`);
  }

  const fullPath = path.join(repoRoot, video.path);
  if (video.status !== 'planned' && !fs.existsSync(fullPath)) {
    throw new Error(`Recorded video is missing on disk: ${video.path}`);
  }

  counts.set(video.exerciseType, counts.get(video.exerciseType) + 1);
}

const plannedTotal = manifest.coverage.reduce((sum, item) => sum + item.requiredCount, 0);
const recordedTotal = manifest.videos.filter((video) =>
  ['recorded', 'annotated', 'approved'].includes(video.status),
).length;
const annotatedTotal = manifest.videos.filter((video) =>
  ['annotated', 'approved'].includes(video.status),
).length;
const approvedTotal = manifest.videos.filter((video) => video.status === 'approved').length;

console.log(`Video dataset plan: ${plannedTotal}/${manifest.requiredTotal} planned slots`);
console.log(`Video dataset media: ${recordedTotal}/${manifest.requiredTotal} recorded files`);
console.log(`Video dataset labels: ${annotatedTotal}/${manifest.requiredTotal} annotated files`);
console.log(`Video dataset approval: ${approvedTotal}/${manifest.requiredTotal} approved files`);

for (const item of manifest.coverage) {
  const current = counts.get(item.exerciseType) || 0;
  if (current > item.requiredCount) {
    throw new Error(`${item.exerciseType} has ${current} rows, exceeds ${item.requiredCount}`);
  }
}

if (strict) {
  if (recordedTotal < manifest.requiredTotal) {
    throw new Error(
      `Strict dataset check failed: ${recordedTotal}/${manifest.requiredTotal} recorded files`,
    );
  }
  if (annotatedTotal < manifest.requiredTotal) {
    throw new Error(
      `Strict dataset check failed: ${annotatedTotal}/${manifest.requiredTotal} annotated files`,
    );
  }
  if (approvedTotal < manifest.requiredTotal) {
    throw new Error(
      `Strict dataset check failed: ${approvedTotal}/${manifest.requiredTotal} approved files`,
    );
  }
}
