# 100-video regression dataset

This document defines the P0 video regression dataset for commercial validation.
The dataset is tracked by `docs/testing/video-dataset-manifest.json` and can be
validated with `node scripts/validate-video-dataset.js`.

## Coverage Target

The first commercial dataset must contain 100 real-device videos:

| Exercise | Count | Required coverage |
| --- | ---: | --- |
| jump_rope | 20 | normal pace, fast pace, slow pace, partial body, low light, side angle |
| squats | 20 | normal depth, shallow squat, fast motion, knee valgus, back lean, side angle |
| sit_ups | 15 | standard motion, incomplete reps, hand-assisted reps, low light |
| jumping_jacks | 15 | normal, low arm raise, narrow leg spread, fast motion |
| standing_long_jump | 15 | standard jump, foul takeoff, unstable landing, side angle |
| vertical_jump | 15 | standard jump, arm swing variants, low jump, occlusion |

## File Rules

- Store source videos outside git under `test-data/videos/`.
- Use relative paths in the manifest, for example
  `test-data/videos/jump_rope/jr-001.mp4`.
- Keep one manifest row per video.
- Fill `expected.count`, `expected.distanceCm`, or `expected.heightCm` only after
  manual annotation.
- Mark `status` as `planned`, `recorded`, `annotated`, or `approved`.

## Acceptance

P0 is complete only when all 100 rows are at least `recorded`, and release-grade
algorithm gates should use only `approved` rows.
