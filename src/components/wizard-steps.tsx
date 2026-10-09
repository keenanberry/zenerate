"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  label: string;
  description?: string;
}

interface WizardStepsProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function WizardSteps({
  steps,
  currentStep,
  onStepClick,
}: WizardStepsProps) {
  return (
    <>
      {/* Mobile: compact view */}
      <div className="flex flex-col gap-3 sm:hidden">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Step {currentStep + 1} of {steps.length}
          </span>
          <span className="text-muted-foreground">
            {steps[currentStep]?.label}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-300"
            style={{
              width: `${((currentStep + 1) / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Desktop: full step indicator -- single grid so circles and labels share columns */}
      <div
        className="hidden sm:grid"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
        }}
      >
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = isCompleted && onStepClick;

          return (
            <div key={step.label} className="flex flex-col items-center gap-2">
              {/* Circle with connector lines extending to cell edges */}
              <div className="relative flex h-8 w-full items-center justify-center">
                {/* Left connector: cell start → circle edge */}
                {index > 0 && (
                  <div
                    className={cn(
                      "absolute top-1/2 left-0 h-0.5 -translate-y-1/2 motion-safe:transition-colors motion-safe:duration-300",
                      isCompleted || isCurrent ? "bg-primary" : "bg-muted"
                    )}
                    style={{ right: "calc(50% + 16px)" }}
                  />
                )}
                {/* Right connector: circle edge → cell end */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "absolute top-1/2 right-0 h-0.5 -translate-y-1/2 motion-safe:transition-colors motion-safe:duration-300",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )}
                    style={{ left: "calc(50% + 16px)" }}
                  />
                )}
                {/* Circle */}
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={!isClickable}
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium motion-safe:transition-colors motion-safe:duration-300",
                    isCompleted &&
                      "bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90",
                    isCurrent &&
                      "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
                    !isCompleted &&
                      !isCurrent &&
                      "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </button>
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-xs transition-colors",
                  isCurrent
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
