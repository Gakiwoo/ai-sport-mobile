const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'docs', 'testing', 'video-dataset-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const approved = manifest.videos.filter((video) => video.status === 'approved');
const annotated = manifest.videos.filter((video) =>
  ['annotated', 'approved'].includes(video.status),
);
const recorded = manifest.videos.filter((video) =>
  ['recorded', 'annotated', 'approved'].includes(video.status),
);

const failures = manifest.videos.filter((video) => video.status !== 'approved');

console.log('AI Sport algorithm regression report');
console.log(`schemaVersion: ${manifest.version}`);
console.log(`requiredTotal: ${manifest.requiredTotal}`);
console.log(`recorded: ${recorded.length}`);
console.log(`annotated: ${annotated.length}`);
console.log(`approved: ${approved.length}`);
console.log('meanError: n/a (waiting for annotated ground truth)');
console.log('missedDetections: n/a');
console.log('falseDetections: n/a');

if (failures.length > 0) {
  console.log('failureExamples:');
  for (const video of failures.slice(0, 20)) {
    console.log(`- ${video.id || '<unassigned>'}: ${video.status}`);
  }
} else {
  console.log('failureExamples: none');
}
