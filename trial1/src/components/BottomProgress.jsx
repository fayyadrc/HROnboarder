import React from 'react';
import { cn } from "@/lib/utils";

const steps = [
  { label: "Welcome", id: 0 },
  { label: "Offer", id: 1 },
  { label: "Identity", id: 2 },
  { label: "Documents", id: 3 },
  { label: "Work Auth", id: 4 },
  { label: "Profile", id: 5 },
  { label: "Review", id: 6 },
];

export function BottomProgress({ currentStep }) {
  // Calculate percentage: (current / total-1) * 100
  const progress = Math.min(100, Math.max(0, (currentStep / (steps.length - 1)) * 100));

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:px-8 z-50">
      <div className="max-w-4xl mx-auto space-y-2">
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Labels - Hidden on small screens, shown on md+ */}
        <div className="hidden md:flex justify-between text-xs text-gray-500 font-medium pt-1">
          {steps.map((step) => (
            <span 
              key={step.id} 
              className={cn(
                "transition-colors duration-300",
                step.id === currentStep && "text-primary font-bold",
                step.id < currentStep && "text-gray-900"
              )}
            >
              {step.label}
            </span>
          ))}
        </div>
        
        {/* Mobile current step indicator */}
        <div className="md:hidden text-xs text-gray-500 text-center font-medium">
          Step {currentStep} of {steps.length - 1}: {steps[currentStep]?.label || 'Done'}
        </div>
      </div>
    </div>
  );
}
