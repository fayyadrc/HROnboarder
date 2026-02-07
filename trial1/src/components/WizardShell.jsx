import React from "react";
import { BottomProgress } from "./BottomProgress";
import AgentActivity from "./AgentActivity";

export function WizardShell({ children, currentStep, isDeclined = false, isPaused = false }) {
  return (
    <div className={`min-h-screen bg-gray-50 font-sans text-gray-900 ${!isDeclined ? (isPaused ? 'pb-32' : 'pb-24') : ''}`}>
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-40 h-16 flex items-center">
        <div className="px-4 sm:px-6 lg:px-8 w-full max-w-6xl mx-auto flex items-center justify-between">
          <div className="font-semibold text-lg tracking-tight text-gray-900">HR Automator</div>
          <div className="text-xs text-gray-500">Hackathon Demo</div>
        </div>
      </header>

      {/* Main */}
      <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">{children}</div>
          <div className="lg:col-span-1">
            <AgentActivity />
          </div>
        </div>
      </main>

      {/* Persistent Bottom Progress - Hidden when declined */}
      {!isDeclined && <BottomProgress currentStep={currentStep} isPaused={isPaused} />}
    </div>
  );
}
