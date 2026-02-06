import React from 'react';
import { BottomProgress } from './BottomProgress';

export function WizardShell({ children, currentStep }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans text-gray-900">
      {/* Header / Logo Area */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-40 h-16 flex items-center justify-center">
        <div className="font-semibold text-lg tracking-tight text-gray-900">
          HR Automator
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
        {children}
      </main>

      {/* Persistent Bottom Progress */}
      {/* Only show progress if we are past the welcome screen (step 0), or user requested to show it always. 
          The prompt says "Visible progress indicator at the bottom". 
          We'll keep it always visible for consistency, or maybe hide on Help/Welcome if needed.
          Let's keep it visible.
      */}
      <BottomProgress currentStep={currentStep} />
    </div>
  );
}
