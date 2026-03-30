import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

const MAX_BINGO_NUMBER = 75;
const FAST_SPIN_STEPS = 16;
const SLOW_SPIN_STEPS = 4;

const getPreviousNumber = (value: number) => {
  return value === 1 ? MAX_BINGO_NUMBER : value - 1;
};

const buildSpinSequence = (targetNumber: number) => {
  const totalSteps = FAST_SPIN_STEPS + SLOW_SPIN_STEPS;
  const sequence: number[] = [targetNumber];
  let currentValue = targetNumber;

  for (let step = 0; step < totalSteps; step += 1) {
    currentValue = getPreviousNumber(currentValue);
    sequence.unshift(currentValue);
  }

  return sequence;
};

const getReelDurationMs = (trackLength: number) => {
  const movementSteps = Math.max(1, trackLength - 1);
  const distanceWeight = Math.min(1, movementSteps / 10);
  const baseDuration = 560 + (1 - distanceWeight) ** 2 * 260;

  return Math.round(baseDuration + movementSteps * 72);
};

type DrawRevealModalProps = {
  animationKey: string;
  isOpen: boolean;
  targetNumber: number | null;
  onAnimationStateChange?: (isAnimating: boolean) => void;
};

export const DrawRevealModal = ({
  animationKey,
  isOpen,
  targetNumber,
  onAnimationStateChange,
}: DrawRevealModalProps) => {
  const sequence = useMemo(() => {
    if (targetNumber === null) return [];
    return isOpen ? buildSpinSequence(targetNumber) : [targetNumber];
  }, [isOpen, targetNumber]);
  const transitionDurationMs = useMemo(
    () => getReelDurationMs(sequence.length),
    [sequence.length],
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettled, setIsSettled] = useState(!isOpen);

  useEffect(() => {
    if (!isOpen) {
      setCurrentIndex(0);
      setIsSettled(true);
      onAnimationStateChange?.(false);
      return;
    }

    if (targetNumber === null) return;

    let animationFrameId = 0;
    let nestedAnimationFrameId = 0;
    onAnimationStateChange?.(true);
    setCurrentIndex(0);
    setIsSettled(false);

    animationFrameId = window.requestAnimationFrame(() => {
      nestedAnimationFrameId = window.requestAnimationFrame(() => {
        setCurrentIndex(Math.max(0, sequence.length - 1));
      });
    });

    const timeoutId = window.setTimeout(() => {
      setIsSettled(true);
      onAnimationStateChange?.(false);
    }, transitionDurationMs + 80);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.cancelAnimationFrame(nestedAnimationFrameId);
      window.clearTimeout(timeoutId);
    };
  }, [
    isOpen,
    onAnimationStateChange,
    sequence.length,
    targetNumber,
    transitionDurationMs,
  ]);

  if (!isOpen || targetNumber === null) return null;

  const reelValues = sequence.length > 0 ? sequence : [targetNumber];

  return (
    <div
      className={`draw-reel-shell ${isSettled ? "is-settled" : ""}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="draw-reel-fade draw-reel-fade-top" />
      <div className="draw-reel-fade draw-reel-fade-bottom" />
      <div className="draw-reel-window">
        <div
          className={`draw-reel-track ${isSettled ? "is-settled" : "is-spinning"}`}
          style={{
            "--draw-reel-duration": `${transitionDurationMs}ms`,
            transform: `translateY(calc(-${currentIndex} * var(--draw-slot-height)))`,
          } as CSSProperties}
        >
          {reelValues.map((value, index) => (
            <div
              key={`${animationKey}-${index}-${value}`}
              className={`draw-reel-value ${
                index === currentIndex ? "is-active" : ""
              }`}
            >
              {value}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
