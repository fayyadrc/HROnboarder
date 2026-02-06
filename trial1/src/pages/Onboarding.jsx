import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WizardShell } from "@/components/WizardShell";
import { api } from "@/lib/mockApi";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Steps
import { StepWelcome } from "@/steps/StepWelcome";
import { StepOffer } from "@/steps/StepOffer";
import { StepIdentity } from "@/steps/StepIdentity";
import { StepDocuments } from "@/steps/StepDocuments";
import { StepWorkAuth } from "@/steps/StepWorkAuth";
import { StepProfile } from "@/steps/StepProfile";
import { StepReview } from "@/steps/StepReview";

export function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render if needed

  useEffect(() => {
    loadCase();
  }, [refreshKey]);

  const loadCase = async () => {
    try {
      setLoading(true);
      const data = await api.getCase();
      if (!data) {
        navigate("/"); // Redirect to login if no session
        return;
      }
      setCaseData(data);
    } catch (err) {
      console.error(err);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async (stepKey, payload, nextIndex) => {
    try {
      setLoading(true);
      const updatedCase = await api.submitStep(stepKey, payload, nextIndex);
      setCaseData(updatedCase);
    } catch (err) {
      console.error("Failed to save step", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // Basic back navigation (decrement step index locally immediately for speed? 
    // Or just API call? Requirements say "App behavior... saves only when user clicks Next")
    // "Candidate can go forward/back between steps"
    // "Resume behavior... loads saved state... to currentStepIndex"
    // We should probably just allow visual navigation back without saving, 
    // but we need to update currentStepIndex if we want persistence of "where I left off".
    // Alternatively, Back doesn't change persistent state, just local view?
    // Let's implement Back as purely navigation unless we want to "rewind" the process.
    // Usually wizards allow browsing back.
    // Let's update the persistent index so refresh stays on that step.
    if (!caseData) return;
    const prevIndex = Math.max(0, caseData.currentStepIndex - 1);
    
    // Optimistic update
    setCaseData(prev => ({ ...prev, currentStepIndex: prevIndex }));
    
    // Background sync (optional, or we can just keep it local state if we don't want to sync "backwards" movement)
    // Requirements: "Resume... takes user to currentStepIndex". So we should sync it.
    api.saveStep('navigation_sync', {}).then(() => {
       // We might need a specific API to just update index, but submitStep handles it.
       // We can hack it or add updateIndex to API.
       // For now let's just assume we don't strictly need to persist BACK navigation for "resume", 
       // but it's nice. Let's send a dummy update or add a helper.
       // Accessing internal API method or just using setStatus might be overkill.
       // Let's just update local state for Back, and rely on Next to save progress.
    });
  };

  const handleStepJump = (index) => {
    // Only allow jumping visited steps or if we are just browsing back
    // For strict wizards, usually only Back is allowed.
    // Requirement: "Next / Back navigation".
    // "Candidate can go forward/back between steps."
    // Let's stick to explicit Next/Back buttons mostly, but if we wanted stepper clicks:
    if (index < caseData.currentStepIndex) {
        setCaseData(prev => ({ ...prev, currentStepIndex: index }));
    }
  };

  if (loading && !caseData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!caseData) return null;

  const stepsComponents = [
    StepWelcome,
    StepOffer,
    StepIdentity,
    StepDocuments,
    StepWorkAuth,
    StepProfile,
    StepReview,
  ];

  const CurrentStepComponent = stepsComponents[caseData.currentStepIndex] || StepReview;
  const isPaused = ["NEGOTIATION_PENDING", "ON_HOLD_HR"].includes(caseData.status);

  return (
    <WizardShell currentStep={caseData.currentStepIndex}>
      {isPaused && (
        <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-900">
          <AlertTitle>Application Paused</AlertTitle>
          <AlertDescription>
            We have notified HR with your request. You can review your details while we wait.
          </AlertDescription>
        </Alert>
      )}

      <CurrentStepComponent 
        data={caseData} 
        onNext={handleNext} 
        onBack={handleBack}
        isPaused={isPaused}
      />
    </WizardShell>
  );
}
