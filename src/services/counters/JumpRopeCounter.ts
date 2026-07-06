import { ExerciseFeedback, Keypoint, Pose } from '../../types';
import { POSE_MIN_SCORE } from '../../constants/exerciseConfig';
import { ExerciseCounter } from '../ExerciseCounter';
import { MultiPointKalman, SlidingWindow } from '../../utils/filters';

type RopePhase = 'idle' | 'detecting' | 'jumping' | 'resting';

enum JumpState {
  Standing = 'STANDING',
  Ascending = 'ASCENDING',
  Airborne = 'AIRBORNE',
  Landing = 'LANDING',
}

interface RopeKeypoints {
  leftShoulder: Keypoint;
  rightShoulder: Keypoint;
  leftHip: Keypoint;
  rightHip: Keypoint;
  leftAnkle: Keypoint;
  rightAnkle: Keypoint;
  leftWrist: Keypoint;
  rightWrist: Keypoint;
}

interface FrameFeatures {
  velocity: number;
  ankleLift: number;
  bodyLift: number;
  bodyHeight: number;
  wristAmplitude: number;
}

export class JumpRopeCounter extends ExerciseCounter {
  private readonly kalman = new MultiPointKalman(0.5, 6);
  private readonly bodyBaselineWindow = new SlidingWindow(90);
  private readonly ankleBaselineWindow = new SlidingWindow(90);
  private readonly leftWristWindow = new SlidingWindow(15);
  private readonly rightWristWindow = new SlidingWindow(15);

  private state = JumpState.Standing;
  private phase: RopePhase = 'idle';
  private phaseFrameCount = 0;
  private calibrated = false;
  private calibrationFrames = 0;
  private bodyBaseline = 0;
  private ankleBaseline = 0;
  private bodyHeight = 1;
  private takeoffThreshold = 1;
  private landThreshold = 0.5;
  private prevBodyY: number | null = null;
  private prevVelocity = 0;
  private airborneFrames = 0;
  private landingFrames = 0;
  private framesSinceLastCount = 0;
  private baselineFrameCounter = 0;
  private consecutiveJumps = 0;
  private countTimestamps: number[] = [];
  private currentWristAmplitude = 0;
  private currentAnkleLift = 0;
  private currentBodyLift = 0;

  private readonly TAKEOFF_BODY_RATIO = 0.06;
  private readonly WRIST_ACTIVE_RATIO = 0.05;
  private readonly WRIST_INACTIVE_LIFT_MULTIPLIER = 1.8;
  private readonly MIN_AIRBORNE_FRAMES_30FPS = 3;
  private readonly MAX_AIRBORNE_FRAMES_30FPS = 25;
  private readonly MIN_LANDING_FRAMES_30FPS = 2;
  private readonly MIN_COUNT_INTERVAL_30FPS = 6;
  private readonly MAX_RECENT_COUNTS = 8;

  reset(): void {
    super.reset();
    this.kalman.reset();
    this.resizeWindows();
    this.bodyBaselineWindow.clear();
    this.ankleBaselineWindow.clear();
    this.leftWristWindow.clear();
    this.rightWristWindow.clear();
    this.state = JumpState.Standing;
    this.phase = 'idle';
    this.phaseFrameCount = 0;
    this.calibrated = false;
    this.calibrationFrames = 0;
    this.bodyBaseline = 0;
    this.ankleBaseline = 0;
    this.bodyHeight = 1;
    this.takeoffThreshold = 1;
    this.landThreshold = 0.5;
    this.prevBodyY = null;
    this.prevVelocity = 0;
    this.airborneFrames = 0;
    this.landingFrames = 0;
    this.framesSinceLastCount = 0;
    this.baselineFrameCounter = 0;
    this.consecutiveJumps = 0;
    this.countTimestamps = [];
    this.currentWristAmplitude = 0;
    this.currentAnkleLift = 0;
    this.currentBodyLift = 0;
  }

  protected onFrameIntervalChanged(): void {
    this.resizeWindows();
  }

  processFrame(pose: Pose): void {
    this.totalFrames++;
    this.framesSinceLastCount++;
    this.phaseFrameCount++;

    const points = this.getRequiredKeypoints(pose);
    if (!points) return;

    const rawShoulderY = (points.leftShoulder.y + points.rightShoulder.y) / 2;
    const rawHipY = (points.leftHip.y + points.rightHip.y) / 2;
    const rawAnkleY = (points.leftAnkle.y + points.rightAnkle.y) / 2;
    const rawBodyCenterY = (rawShoulderY + rawHipY) / 2;
    const rawBodyHeight = Math.max(1, Math.abs(rawAnkleY - rawBodyCenterY));

    const bodyY = this.kalman.update('bodyCenterY', rawBodyCenterY);
    const ankleY = this.kalman.update('ankleCenterY', rawAnkleY);
    const smoothBodyHeight = this.kalman.update('bodyHeight', rawBodyHeight);
    const leftWristY = this.kalman.update('leftWristY', points.leftWrist.y);
    const rightWristY = this.kalman.update('rightWristY', points.rightWrist.y);

    let velocity = 0;
    if (this.prevBodyY !== null) {
      velocity = bodyY - this.prevBodyY;
    }
    this.prevBodyY = bodyY;

    this.leftWristWindow.push(leftWristY);
    this.rightWristWindow.push(rightWristY);
    this.currentWristAmplitude = Math.max(
      this.leftWristWindow.max() - this.leftWristWindow.min(),
      this.rightWristWindow.max() - this.rightWristWindow.min(),
    );

    this.bodyBaselineWindow.push(bodyY);
    this.ankleBaselineWindow.push(ankleY);
    this.calibrationFrames++;

    if (!this.calibrated) {
      this.tryCompleteCalibration(smoothBodyHeight);
      return;
    }

    this.updateDynamicBaseline(smoothBodyHeight);

    this.currentAnkleLift = Math.max(0, this.ankleBaseline - ankleY);
    this.currentBodyLift = Math.max(0, this.bodyBaseline - bodyY);
    this.runStateMachine({
      velocity,
      ankleLift: this.currentAnkleLift,
      bodyLift: this.currentBodyLift,
      bodyHeight: this.bodyHeight,
      wristAmplitude: this.currentWristAmplitude,
    });
  }

  getPhase(): RopePhase {
    return this.phase;
  }

  getConsecutiveJumps(): number {
    return this.consecutiveJumps;
  }

  isCalibrated(): boolean {
    return this.calibrated;
  }

  getResultValue(): number {
    return this.count;
  }

  getResultUnit(): string {
    return '次';
  }

  getFeedback(_pose?: Pose): ExerciseFeedback | null {
    if (!this.calibrated) {
      return { type: 'warning', message: '请站稳，系统正在标定' };
    }

    const bpm = this.getJumpRatePerMinute();
    if (bpm > 200) {
      return { type: 'warning', message: '节奏太快，放慢一些' };
    }
    if (bpm > 0 && bpm < 40 && this.count > 3) {
      return { type: 'warning', message: '节奏太慢，加快速度' };
    }
    if (bpm >= 120 && bpm <= 180 && this.count >= 5) {
      return { type: 'success', message: '节奏稳定，保持' };
    }
    if (this.phase === 'idle') {
      return { type: 'warning', message: '准备跳绳，手腕开始甩动' };
    }
    return null;
  }

  protected getKeyMetrics(): Record<string, number> {
    return {
      ...super.getKeyMetrics(),
      ankleLift: Math.round(this.currentAnkleLift * 10) / 10,
      bodyLift: Math.round(this.currentBodyLift * 10) / 10,
      wristAmplitude: Math.round(this.currentWristAmplitude * 10) / 10,
      consecutiveJumps: this.consecutiveJumps,
    };
  }

  private resizeWindows(): void {
    this.bodyBaselineWindow.resize(this.framesAt30Fps(90));
    this.ankleBaselineWindow.resize(this.framesAt30Fps(90));
    this.leftWristWindow.resize(this.framesAt30Fps(15));
    this.rightWristWindow.resize(this.framesAt30Fps(15));
  }

  private getRequiredKeypoints(pose: Pose): RopeKeypoints | null {
    const leftShoulder = this.getKeypoint(pose, 'left_shoulder');
    const rightShoulder = this.getKeypoint(pose, 'right_shoulder');
    const leftHip = this.getKeypoint(pose, 'left_hip');
    const rightHip = this.getKeypoint(pose, 'right_hip');
    const leftAnkle = this.getKeypoint(pose, 'left_ankle');
    const rightAnkle = this.getKeypoint(pose, 'right_ankle');
    const leftWrist = this.getKeypoint(pose, 'left_wrist');
    const rightWrist = this.getKeypoint(pose, 'right_wrist');

    if (
      !leftShoulder ||
      !rightShoulder ||
      !leftHip ||
      !rightHip ||
      !leftAnkle ||
      !rightAnkle ||
      !leftWrist ||
      !rightWrist
    ) {
      return null;
    }

    const points = [
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
      leftAnkle,
      rightAnkle,
      leftWrist,
      rightWrist,
    ];
    if (points.some((point) => (point.score ?? 0) < POSE_MIN_SCORE)) {
      return null;
    }

    return {
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
      leftAnkle,
      rightAnkle,
      leftWrist,
      rightWrist,
    };
  }

  private tryCompleteCalibration(smoothBodyHeight: number): void {
    if (this.calibrationFrames < this.framesAt30Fps(20)) return;
    if (this.bodyBaselineWindow.size === 0 || this.ankleBaselineWindow.size === 0) return;

    this.calibrated = true;
    this.bodyBaseline = this.bodyBaselineWindow.median();
    this.ankleBaseline = this.ankleBaselineWindow.median();
    this.bodyHeight = Math.max(1, smoothBodyHeight);
    this.takeoffThreshold = this.bodyHeight * this.TAKEOFF_BODY_RATIO;
    this.landThreshold = this.takeoffThreshold * 0.5;
    this.syncPhase();
  }

  private updateDynamicBaseline(smoothBodyHeight: number): void {
    if (this.state !== JumpState.Standing || this.framesSinceLastCount <= this.minCountInterval()) {
      this.baselineFrameCounter = 0;
      return;
    }

    this.baselineFrameCounter++;
    if (this.baselineFrameCounter < this.framesAt30Fps(10)) return;

    this.baselineFrameCounter = 0;
    this.bodyBaseline = this.bodyBaselineWindow.median();
    this.ankleBaseline = this.ankleBaselineWindow.median();
    this.bodyHeight = this.bodyHeight * 0.9 + Math.max(1, smoothBodyHeight) * 0.1;
    this.takeoffThreshold = this.bodyHeight * this.TAKEOFF_BODY_RATIO;
    this.landThreshold = this.takeoffThreshold * 0.5;
  }

  private runStateMachine(features: FrameFeatures): void {
    switch (this.state) {
      case JumpState.Standing:
        this.handleStanding(features);
        break;
      case JumpState.Ascending:
        this.handleAscending(features);
        break;
      case JumpState.Airborne:
        this.handleAirborne(features);
        break;
      case JumpState.Landing:
        this.handleLanding(features);
        break;
    }
    this.prevVelocity = features.velocity;
    this.syncPhase();
  }

  private handleStanding(features: FrameFeatures): void {
    const wristActive =
      features.wristAmplitude >= Math.max(4, features.bodyHeight * this.WRIST_ACTIVE_RATIO);
    const threshold = wristActive
      ? this.takeoffThreshold
      : this.takeoffThreshold * this.WRIST_INACTIVE_LIFT_MULTIPLIER;

    if (features.ankleLift >= threshold && features.velocity < -0.4) {
      this.transitionTo(JumpState.Ascending);
      this.airborneFrames = 0;
      this.landingFrames = 0;
    }
  }

  private handleAscending(features: FrameFeatures): void {
    this.airborneFrames++;
    if (features.velocity > 0.2 && this.prevVelocity <= 0) {
      this.transitionTo(JumpState.Airborne);
    } else if (this.airborneFrames > this.maxAirborneFrames()) {
      this.transitionTo(JumpState.Standing);
    }
  }

  private handleAirborne(features: FrameFeatures): void {
    this.airborneFrames++;
    if (this.airborneFrames > this.maxAirborneFrames()) {
      this.transitionTo(JumpState.Standing);
      return;
    }

    if (features.ankleLift < this.landThreshold) {
      if (this.airborneFrames < this.minAirborneFrames()) {
        this.transitionTo(JumpState.Standing);
        return;
      }
      this.transitionTo(JumpState.Landing);
      this.landingFrames = 0;
    }
  }

  private handleLanding(features: FrameFeatures): void {
    this.landingFrames++;
    this.airborneFrames++;

    if (features.ankleLift >= this.takeoffThreshold) {
      this.transitionTo(JumpState.Airborne);
      return;
    }
    if (this.landingFrames < this.minLandingFrames()) return;

    if (this.framesSinceLastCount >= this.minCountInterval()) {
      this.count++;
      this.consecutiveJumps++;
      this.framesSinceLastCount = 0;
      this.countTimestamps.push(Date.now());
      if (this.countTimestamps.length > this.MAX_RECENT_COUNTS) {
        this.countTimestamps.shift();
      }
    }
    this.transitionTo(JumpState.Standing);
  }

  private transitionTo(nextState: JumpState): void {
    if (this.state !== nextState) {
      this.phaseFrameCount = 0;
    }
    this.state = nextState;
  }

  private syncPhase(): void {
    const nextPhase = this.mapStateToPhase();
    this.phase = nextPhase;
    this.lastState = nextPhase;
  }

  private mapStateToPhase(): RopePhase {
    if (!this.calibrated) return 'idle';
    switch (this.state) {
      case JumpState.Standing:
        return 'idle';
      case JumpState.Ascending:
        return 'detecting';
      case JumpState.Airborne:
        return 'jumping';
      case JumpState.Landing:
        return 'resting';
    }
  }

  private getJumpRatePerMinute(): number {
    if (this.countTimestamps.length < 2) return 0;
    const intervals: number[] = [];
    for (let i = 1; i < this.countTimestamps.length; i++) {
      intervals.push(this.countTimestamps[i] - this.countTimestamps[i - 1]);
    }
    const avgInterval = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    return avgInterval > 0 ? Math.round(60000 / avgInterval) : 0;
  }

  private minAirborneFrames(): number {
    return this.framesAt30Fps(this.MIN_AIRBORNE_FRAMES_30FPS);
  }

  private maxAirborneFrames(): number {
    return this.framesAt30Fps(this.MAX_AIRBORNE_FRAMES_30FPS);
  }

  private minLandingFrames(): number {
    return this.framesAt30Fps(this.MIN_LANDING_FRAMES_30FPS);
  }

  private minCountInterval(): number {
    return this.framesAt30Fps(this.MIN_COUNT_INTERVAL_30FPS);
  }
}
