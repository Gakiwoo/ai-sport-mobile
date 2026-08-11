/**
 * Backward-compatible re-export of @ai-sport/core filters.
 *
 * This file maintains the old Mobile API surface while delegating to the
 * shared package implementation. Counter files can import from here unchanged.
 *
 * API mapping:
 *   .filter(v) → .update(v)            (KalmanFilter1D)
 *   .filter(key, v) → .update(key, v)  (MultiPointKalman)
 *   .mean() → .getMean()               (SlidingWindow)
 *   .stddev() → .getStdDev()           (SlidingWindow)
 *   .variance() → .getStdDev() ** 2    (SlidingWindow)
 *   .median() → .getMedian()           (SlidingWindow)
 *   .min() → .getMin()                 (SlidingWindow)
 *   .max() → .getMax()                 (SlidingWindow)
 *   .clear() → .reset()                (SlidingWindow)
 *   .size → .length                    (SlidingWindow)
 *
 * Migration: To use the shared API directly, import from '@ai-sport/core' instead.
 */

import {
  KalmanFilter1D as CoreKalmanFilter1D,
  SlidingWindow as CoreSlidingWindow,
  MultiPointKalman as CoreMultiPointKalman,
} from '@ai-sport/core';

/**
 * Backward-compatible KalmanFilter1D wrapper.
 *
 * Mobile historically used positional constructor args and a `.filter(value)`
 * method. The shared package uses an options object and `.update(value)`.
 * This wrapper preserves the old Mobile constructor signature; both `.filter()`
 * and `.update()` are available.
 *
 * The shared class adds velocity tracking and `.isInitialized`. Note that the
 * shared `.state` accessor returns `{ value, velocity }` rather than a bare
 * number — use `.state.value` if migrating off this wrapper.
 */
export class KalmanFilter1D extends CoreKalmanFilter1D {
  constructor(processNoise?: number, measurementNoise?: number) {
    super({ processNoise, measurementNoise });
  }

  /** @deprecated Use .update(value) instead — kept for legacy compatibility */
  filter(value: number): number {
    return this.update(value);
  }
}

/**
 * Backward-compatible SlidingWindow wrapper.
 *
 * Adds the legacy Mobile method names (mean/stddev/variance/median/min/max/
 * clear/size) on top of the shared ring-buffer implementation. The shared
 * `.push()`, `.last()`, `.resize()`, `.capacity`, `.isFull`, `.data` and
 * `.length` members are inherited unchanged.
 *
 * Note: the legacy Mobile `.variance()` returned `Infinity` for windows with
 * fewer than 2 samples; this wrapper returns `0` in that case (matching the
 * shared `.getStdDev()` convention).
 */
export class SlidingWindow extends CoreSlidingWindow {
  /** @deprecated Use .getMean() instead */
  mean(): number {
    return this.getMean();
  }

  /** @deprecated Use .getStdDev() instead */
  stddev(): number {
    return this.getStdDev();
  }

  /** @deprecated Use .getStdDev() ** 2 instead */
  variance(): number {
    const sd = this.getStdDev();
    return sd * sd;
  }

  /** @deprecated Use .getMedian() instead */
  median(): number {
    return this.getMedian();
  }

  /** @deprecated Use .getMin() instead */
  min(): number {
    return this.getMin();
  }

  /** @deprecated Use .getMax() instead */
  max(): number {
    return this.getMax();
  }

  /** @deprecated Use .reset() instead */
  clear(): void {
    this.reset();
  }

  /** @deprecated Use .length instead */
  get size(): number {
    return this.length;
  }
}

/**
 * Backward-compatible MultiPointKalman wrapper.
 *
 * Mobile historically used positional constructor args and a `.filter(key, value)`
 * method. The shared package uses an options object and `.update(key, value)`.
 * This wrapper preserves the old Mobile constructor signature; both `.filter()`
 * and `.update()` are available. The shared `.getFilter(key)` and `.reset()`
 * members are inherited unchanged.
 */
export class MultiPointKalman extends CoreMultiPointKalman {
  constructor(processNoise?: number, measurementNoise?: number) {
    super({ processNoise, measurementNoise });
  }

  /** @deprecated Use .update(key, value) instead — kept for legacy compatibility */
  filter(key: string, value: number): number {
    return this.update(key, value);
  }
}
