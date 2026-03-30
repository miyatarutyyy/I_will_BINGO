import { useEffect, useMemo, useState } from "react";

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

const getStepDelay = (stepIndex: number) => {
  if (stepIndex <= FAST_SPIN_STEPS) {
    return 84;
  }

  const slowdownIndex = stepIndex - FAST_SPIN_STEPS;
  return 115 + slowdownIndex * 35;
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettled, setIsSettled] = useState(!isOpen);

  useEffect(() => {
    if (!isOpen) {
      onAnimationStateChange?.(false);
      return;
    }

    if (targetNumber === null) return;

    const timeoutIds: number[] = [];

    onAnimationStateChange?.(true);

    let elapsed = 0;

    for (let stepIndex = 1; stepIndex < sequence.length; stepIndex += 1) {
      elapsed += getStepDelay(stepIndex);
      timeoutIds.push(
        window.setTimeout(() => {
          setCurrentIndex(stepIndex);
        }, elapsed),
      );
    }

    timeoutIds.push(
      window.setTimeout(() => {
        setIsSettled(true);
        onAnimationStateChange?.(false);
      }, elapsed + 80),
    );

    return () => {
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isOpen, onAnimationStateChange, sequence, targetNumber]);

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
          className="draw-reel-track"
          style={{
            transform: `translateY(calc(-${currentIndex} * var(--draw-slot-height)))`,
          }}
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
