import { useEffect, useRef, useState } from "react";

const MAX_BINGO_NUMBER = 75;
const FAST_SPIN_STEPS = 16;
const SLOW_SPIN_STEPS = 4;

const getRandomNumber = (exclude: number) => {
  let value = exclude;

  while (value === exclude) {
    value = Math.floor(Math.random() * MAX_BINGO_NUMBER) + 1;
  }

  return value;
};

const buildSpinSequence = (targetNumber: number) => {
  const sequence: number[] = [getRandomNumber(targetNumber)];

  for (let step = 0; step < FAST_SPIN_STEPS + SLOW_SPIN_STEPS; step += 1) {
    const previousValue = sequence[sequence.length - 1] ?? targetNumber;
    const nextValue =
      step < FAST_SPIN_STEPS + SLOW_SPIN_STEPS - 1
        ? getRandomNumber(previousValue)
        : targetNumber;

    sequence.push(nextValue);
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
  round: number;
  targetNumber: number | null;
  onComplete: () => void;
};

export const DrawRevealModal = ({
  animationKey,
  isOpen,
  round,
  targetNumber,
  onComplete,
}: DrawRevealModalProps) => {
  const [sequence, setSequence] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettled, setIsSettled] = useState(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!isOpen || targetNumber === null) return;

    const nextSequence = buildSpinSequence(targetNumber);
    const timeoutIds: number[] = [];

    setSequence(nextSequence);
    setCurrentIndex(0);
    setIsSettled(false);

    let elapsed = 0;

    for (let stepIndex = 1; stepIndex < nextSequence.length; stepIndex += 1) {
      elapsed += getStepDelay(stepIndex);
      timeoutIds.push(window.setTimeout(() => {
        setCurrentIndex(stepIndex);
      }, elapsed));
    }

    timeoutIds.push(
      window.setTimeout(() => {
        setIsSettled(true);
      }, elapsed + 80),
    );
    timeoutIds.push(
      window.setTimeout(() => {
        onCompleteRef.current();
      }, elapsed + 780),
    );

    return () => {
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [animationKey, isOpen, targetNumber]);

  if (!isOpen || targetNumber === null) return null;

  const reelValues = sequence.length > 0 ? sequence : [targetNumber];

  return (
    <div className="draw-reveal-overlay" role="presentation">
      <section
        className={`draw-reveal-modal ${isSettled ? "is-settled" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="draw-reveal-heading"
      >
        <p id="draw-reveal-heading" className="draw-reveal-round">
          Round {round}
        </p>

        <div className="draw-reel-shell" aria-live="polite" aria-atomic="true">
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
      </section>
    </div>
  );
};
