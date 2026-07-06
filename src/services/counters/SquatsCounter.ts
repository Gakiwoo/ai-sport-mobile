import { ExerciseFeedback, Keypoint, Pose } from '../../types';
import { POSE_MIN_SCORE } from '../../constants/exerciseConfig';
import { ExerciseCounter } from '../ExerciseCounter';
import { KalmanFilter1D, SlidingWindow } from '../../utils/filters';

type SquatPhase = 'idle' | 'standing' | 'descending' | 'bottom' | 'ascending';
type FoulType = 'shallow_squat' | 'back_lean' | 'knee_valgus' | 'too_fast';

interface SquatKeypoints {
  leftShoulder: Keypoint;
  rightShoulder: Keypoint;
  leftHip: Keypoint;
  rightHip: Keypoint;
  leftKnee: Keypoint;
  rightKnee: Keypoint;
  leftAnkle: Keypoint;
  rightAnkle: Keypoint;
}

export class SquatsCounter extends ExerciseCounter {
  private readonly leftKneeFilter = new KalmanFilter1D(0.3, 4);
  private readonly rightKneeFilter = new KalmanFilter1D(0.3, 4);
  private readonly leftHipFilter = new KalmanFilter1D(0.3, 4);
  private readonly rightHipFilter = new KalmanFilter1D(0.3, 4);
  private readonly centerYFilter = new KalmanFilter1D(0.5, 6);

  private readonly kneeAngleWindow = new SlidingWindow(7);
  private readonly hipAngleWindow = new SlidingWindow(7);
  private readonly stabilityWindow = new SlidingWindow(10);
  private readonly calibrationKnees: number[] = [];
  private readonly calibrationHips: number[] = [];
  private readonly calibrationCenters: number[] = [];
  private readonly calibrationHeights: number[] = [];

  private phase: SquatPhase = 'idle';
  private phaseFrameCount = 0;
  private standingKneeAngle = 170;
  private standingHipAngle = 160;
  private standingCenterY = 0;
  private bodyHeight = 1;
  private calibrated = false;

  private pendingDown = false;
  private cycleStartFrame = 0;
  private minKneeAngleInCycle = 180;
  private maxDepthScoreInCycle = 0;
  private currentKneeAngle = 180;
  private currentHipAngle = 180;
  private currentDepthScore = 0;
  private foulCount = 0;
  private lastFoul: FoulType | null = null;

  private readonly CALIBRATION_REQUIRED = 3;
  private readonly STABLE_KNEE_STDDEV = 3;
  private readonly DESCEND_THRESHOLD = 0.32;
  private readonly DOWN_THRESHOLD = 0.55;
  private readonly UP_THRESHOLD = 0.22;
  private readonly MIN_VALID_DEPTH = 0.52;
  private readonly MIN_VALID_KNEE_ANGLE = 120;
  private readonly MIN_CYCLE_FRAMES_30FPS = 8;
  private readonly MAX_CYCLE_FRAMES_30FPS = 150;

  constructor() {
    super();
    this.reset();
  }

  reset(): void {
    super.reset();
    this.phase = 'idle';
    this.phaseFrameCount = 0;
    this.standingKneeAngle = 170;
    this.standingHipAngle = 160;
    this.standingCenterY = 0;
    this.bodyHeight = 1;
    this.calibrated = false;
    this.pendingDown = false;
    this.cycleStartFrame = 0;
    this.minKneeAngleInCycle = 180;
    this.maxDepthScoreInCycle = 0;
    this.currentKneeAngle = 180;
    this.currentHipAngle = 180;
    this.currentDepthScore = 0;
    this.foulCount = 0;
    this.lastFoul = null;
    this.leftKneeFilter.reset(170);
    this.rightKneeFilter.reset(170);
    this.leftHipFilter.reset(160);
    this.rightHipFilter.reset(160);
    this.centerYFilter.reset(0);
    this.calibrationKnees.length = 0;
    this.calibrationHips.length = 0;
    this.calibrationCenters.length = 0;
    this.calibrationHeights.length = 0;
    this.resizeWindows();
    this.kneeAngleWindow.clear();
    this.hipAngleWindow.clear();
    this.stabilityWindow.clear();
  }

  protected onFrameIntervalChanged(): void {
    this.resizeWindows();
  }

  processFrame(pose: Pose): void {
    this.totalFrames++;

    const points = this.getRequiredKeypoints(pose);
    if (!points) return;

    const leftKneeAngle = this.calculateAngle(pose, 'left_hip', 'left_knee', 'left_ankle');
    const rightKneeAngle = this.calculateAngle(pose, 'right_hip', 'right_knee', 'right_ankle');
    const leftHipAngle = this.calculateAngle(pose, 'left_shoulder', 'left_hip', 'left_knee');
    const rightHipAngle = this.calculateAngle(pose, 'right_shoulder', 'right_hip', 'right_knee');
    if (
      leftKneeAngle === null ||
      rightKneeAngle === null ||
      leftHipAngle === null ||
      rightHipAngle === null
    ) {
      return;
    }

    const rawCenterY = this.calculateBodyCenterY(points);
    const rawBodyHeight = this.calculateBodyHeight(points, rawCenterY);
    const smoothKneeAngle =
      (this.leftKneeFilter.filter(leftKneeAngle) + this.rightKneeFilter.filter(rightKneeAngle)) / 2;
    const smoothHipAngle =
      (this.leftHipFilter.filter(leftHipAngle) + this.rightHipFilter.filter(rightHipAngle)) / 2;
    const smoothCenterY = this.centerYFilter.filter(rawCenterY);

    this.kneeAngleWindow.push(smoothKneeAngle);
    this.hipAngleWindow.push(smoothHipAngle);
    this.currentKneeAngle = this.kneeAngleWindow.mean();
    this.currentHipAngle = this.hipAngleWindow.mean();

    this.phaseFrameCount++;

    if (!this.calibrated) {
      this.collectCalibrationSample(smoothCenterY, rawBodyHeight);
      return;
    }

    this.currentDepthScore = this.calculateDepthScore(smoothCenterY);
    this.trackFouls(points);
    this.runStateMachine();
  }

  getPhase(): SquatPhase {
    return this.phase;
  }

  getResultValue(): number {
    return this.count;
  }

  getResultUnit(): string {
    return '次';
  }

  getKneeAngle(): number {
    return Math.round(this.currentKneeAngle);
  }

  getMinKneeAngle(): number {
    return Math.round(this.minKneeAngleInCycle);
  }

  getFoulCount(): number {
    return this.foulCount;
  }

  getLastFoul(): FoulType | null {
    return this.lastFoul;
  }

  getFeedback(_pose?: Pose): ExerciseFeedback | null {
    if (!this.calibrated) {
      return { type: 'warning', message: '请站直并保持稳定，正在校准' };
    }
    if (this.lastFoul === 'back_lean') {
      return { type: 'error', message: '背部保持挺直，不要过度前倾' };
    }
    if (this.lastFoul === 'knee_valgus') {
      return { type: 'warning', message: '膝盖对准脚尖，避免内扣' };
    }
    if (this.phase === 'descending' && this.currentDepthScore < this.DOWN_THRESHOLD) {
      return { type: 'warning', message: '继续下蹲，深度还不够' };
    }
    if (this.phase === 'bottom') {
      return { type: 'success', message: '深度到位，准备起身' };
    }
    return null;
  }

  protected getKeyMetrics(): Record<string, number> {
    return {
      ...super.getKeyMetrics(),
      kneeAngle: Math.round(this.currentKneeAngle),
      hipAngle: Math.round(this.currentHipAngle),
      depthScore: Math.round(this.currentDepthScore * 100) / 100,
      foulCount: this.foulCount,
    };
  }

  private resizeWindows(): void {
    this.kneeAngleWindow.resize(this.framesAt30Fps(7));
    this.hipAngleWindow.resize(this.framesAt30Fps(7));
    this.stabilityWindow.resize(this.framesAt30Fps(10));
  }

  private getRequiredKeypoints(pose: Pose): SquatKeypoints | null {
    const leftShoulder = this.getKeypoint(pose, 'left_shoulder');
    const rightShoulder = this.getKeypoint(pose, 'right_shoulder');
    const leftHip = this.getKeypoint(pose, 'left_hip');
    const rightHip = this.getKeypoint(pose, 'right_hip');
    const leftKnee = this.getKeypoint(pose, 'left_knee');
    const rightKnee = this.getKeypoint(pose, 'right_knee');
    const leftAnkle = this.getKeypoint(pose, 'left_ankle');
    const rightAnkle = this.getKeypoint(pose, 'right_ankle');

    if (
      !leftShoulder ||
      !rightShoulder ||
      !leftHip ||
      !rightHip ||
      !leftKnee ||
      !rightKnee ||
      !leftAnkle ||
      !rightAnkle
    ) {
      return null;
    }

    const points = [
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
      leftKnee,
      rightKnee,
      leftAnkle,
      rightAnkle,
    ];
    if (points.some((point) => (point.score ?? 0) < POSE_MIN_SCORE)) {
      return null;
    }

    return {
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
      leftKnee,
      rightKnee,
      leftAnkle,
      rightAnkle,
    };
  }

  private collectCalibrationSample(centerY: number, bodyHeight: number): void {
    this.stabilityWindow.push(this.currentKneeAngle);
    if (!this.stabilityWindow.isFull || this.stabilityWindow.stddev() > this.STABLE_KNEE_STDDEV) {
      return;
    }

    this.calibrationKnees.push(this.currentKneeAngle);
    this.calibrationHips.push(this.currentHipAngle);
    this.calibrationCenters.push(centerY);
    this.calibrationHeights.push(bodyHeight);
    this.stabilityWindow.clear();

    if (this.calibrationKnees.length < this.CALIBRATION_REQUIRED) return;

    this.standingKneeAngle = this.average(this.calibrationKnees);
    this.standingHipAngle = this.average(this.calibrationHips);
    this.standingCenterY = this.average(this.calibrationCenters);
    this.bodyHeight = Math.max(1, this.average(this.calibrationHeights));
    this.calibrated = true;
    this.transitionTo('standing');
  }

  private runStateMachine(): void {
    this.maxDepthScoreInCycle = Math.max(this.maxDepthScoreInCycle, this.currentDepthScore);
    this.minKneeAngleInCycle = Math.min(this.minKneeAngleInCycle, this.currentKneeAngle);

    switch (this.phase) {
      case 'standing':
      case 'idle':
        if (this.currentDepthScore >= this.DESCEND_THRESHOLD) {
          this.pendingDown = false;
          this.cycleStartFrame = this.totalFrames;
          this.minKneeAngleInCycle = this.currentKneeAngle;
          this.maxDepthScoreInCycle = this.currentDepthScore;
          this.transitionTo('descending');
        }
        break;
      case 'descending':
        if (this.currentDepthScore >= this.DOWN_THRESHOLD) {
          this.pendingDown = true;
          this.transitionTo('bottom');
        } else if (this.currentDepthScore <= this.UP_THRESHOLD) {
          this.transitionTo('standing');
        }
        break;
      case 'bottom':
        if (this.currentDepthScore < this.DOWN_THRESHOLD * 0.82) {
          this.transitionTo('ascending');
        }
        break;
      case 'ascending':
        if (this.currentDepthScore <= this.UP_THRESHOLD) {
          this.recordSquatIfValid();
          this.transitionTo('standing');
        } else if (this.currentDepthScore >= this.DOWN_THRESHOLD) {
          this.transitionTo('bottom');
        }
        break;
    }
  }

  private recordSquatIfValid(): void {
    const cycleFrames = this.totalFrames - this.cycleStartFrame;
    if (cycleFrames < this.framesAt30Fps(this.MIN_CYCLE_FRAMES_30FPS)) {
      this.lastFoul = 'too_fast';
      this.foulCount++;
      return;
    }
    if (cycleFrames > this.framesAt30Fps(this.MAX_CYCLE_FRAMES_30FPS)) {
      return;
    }
    if (
      !this.pendingDown ||
      this.maxDepthScoreInCycle < this.MIN_VALID_DEPTH ||
      this.minKneeAngleInCycle > this.MIN_VALID_KNEE_ANGLE
    ) {
      this.lastFoul = 'shallow_squat';
      return;
    }

    this.count++;
    this.pendingDown = false;
    if (this.lastFoul === 'shallow_squat' || this.lastFoul === 'too_fast') {
      this.lastFoul = null;
    }
  }

  private calculateDepthScore(centerY: number): number {
    const kneeRange = Math.max(30, this.standingKneeAngle - 60);
    const hipRange = Math.max(20, this.standingHipAngle - 45);
    const yRange = Math.max(1, this.bodyHeight * 0.18);

    const kneeScore = this.clamp01((this.standingKneeAngle - this.currentKneeAngle) / kneeRange);
    const hipScore = this.clamp01((this.standingHipAngle - this.currentHipAngle) / hipRange);
    const yScore = this.clamp01((centerY - this.standingCenterY) / yRange);

    return kneeScore * 0.5 + hipScore * 0.3 + yScore * 0.2;
  }

  private trackFouls(points: SquatKeypoints): void {
    const shoulderMidX = (points.leftShoulder.x + points.rightShoulder.x) / 2;
    const hipMidX = (points.leftHip.x + points.rightHip.x) / 2;
    const hipWidth = Math.abs(points.rightHip.x - points.leftHip.x);
    if (hipWidth > 0 && Math.abs(shoulderMidX - hipMidX) > hipWidth * 0.65) {
      this.lastFoul = 'back_lean';
      this.foulCount++;
      return;
    }

    const leftValgus = points.leftKnee.x < points.leftAnkle.x - hipWidth * 0.08;
    const rightValgus = points.rightKnee.x > points.rightAnkle.x + hipWidth * 0.08;
    if (leftValgus || rightValgus) {
      this.lastFoul = 'knee_valgus';
    }
  }

  private transitionTo(nextPhase: SquatPhase): void {
    if (this.phase !== nextPhase) {
      this.phaseFrameCount = 0;
    }
    this.phase = nextPhase;
    this.lastState = nextPhase;
  }

  private calculateBodyCenterY(points: SquatKeypoints): number {
    const shoulderY = (points.leftShoulder.y + points.rightShoulder.y) / 2;
    const hipY = (points.leftHip.y + points.rightHip.y) / 2;
    const ankleY = (points.leftAnkle.y + points.rightAnkle.y) / 2;
    return shoulderY * 0.2 + hipY * 0.5 + ankleY * 0.3;
  }

  private calculateBodyHeight(points: SquatKeypoints, centerY: number): number {
    const ankleY = (points.leftAnkle.y + points.rightAnkle.y) / 2;
    return Math.max(1, Math.abs(ankleY - centerY));
  }

  private average(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  }

  private clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }
}
