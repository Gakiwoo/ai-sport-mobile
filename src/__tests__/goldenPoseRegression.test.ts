import fs from 'fs';
import path from 'path';
import { GoldenPoseFixture } from './fixtures/goldenPoses/types';
import { assertGoldenExpectation, poseFromPreset, runGoldenPoseFixture } from './goldenPoseRunner';

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'goldenPoses');

function loadGoldenFixtures(): GoldenPoseFixture[] {
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const raw = fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
      return JSON.parse(raw) as GoldenPoseFixture;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

const FIXTURES = loadGoldenFixtures();

const RESULTS: Record<string, { count: number; phase: string; calibrated?: boolean }> = {};

describe('golden pose regression', () => {
  it('loads at least one fixture per exercise type', () => {
    const types = new Set(FIXTURES.map((f) => f.exerciseType));
    expect(types.size).toBeGreaterThanOrEqual(6);
  });

  it.each(FIXTURES)('$id — $description', (fixture) => {
    const result = runGoldenPoseFixture(fixture);
    RESULTS[fixture.id] = {
      count: result.count,
      phase: result.phase,
      calibrated: result.calibrated,
    };
    assertGoldenExpectation(fixture, result);
  });

  it('resolves every preset used in fixtures', () => {
    const presets = new Set(FIXTURES.flatMap((f) => f.steps.map((s) => s.preset)));
    presets.forEach((preset) => {
      expect(poseFromPreset(preset).keypoints.length).toBeGreaterThan(0);
    });
  });

  // 跨端对比报告导出：设置 GOLDEN_REPORT=1 时写出 golden-report.json
  it('exports golden report when GOLDEN_REPORT is set', () => {
    if (!process.env.GOLDEN_REPORT) return;
    const report = {
      platform: 'mobile',
      generatedAt: new Date().toISOString(),
      results: RESULTS,
    };
    fs.writeFileSync(path.join(__dirname, 'golden-report.json'), JSON.stringify(report, null, 2));
    expect(true).toBe(true);
  });
});
