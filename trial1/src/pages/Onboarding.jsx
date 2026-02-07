import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WizardShell } from "@/components/WizardShell";
import { api } from "@/lib/mockApi";
import { Loader2, Clock, AlertCircle } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";

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
  const isPaused = ["NEGOTIATION_PENDING", "ON_HOLD_HR", "PAUSED_BY_HR"].includes(caseData.status);
  const isDeclined = caseData.status === "DECLINED";

  // Declined state view - show thank you message
  if (isDeclined) {
    return (
      <WizardShell currentStep={caseData.currentStepIndex} isDeclined={true}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md mx-auto p-8 bg-white rounded-lg shadow-md border border-gray-100">
            <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">Thank You for Contacting Us</h2>
            <p className="text-gray-600 mb-6">
              We appreciate you taking the time to consider this opportunity. 
              If you change your mind or have any questions, please don't hesitate to reach out to our HR team.
            </p>
            <p className="text-sm text-gray-500">
              We wish you the best in your future endeavors.
            </p>
          </div>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell currentStep={caseData.currentStepIndex} isDeclined={false} isPaused={isPaused}>
      {/* Paused State Modal - Blocking modal that prevents user interaction */}
      <Dialog open={isPaused}>
        <DialogContent hideCloseButton preventClose>
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-amber-100 rounded-full">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <DialogTitle className="text-center">Application Paused</DialogTitle>
            <DialogDescription className="text-center pt-2">
              Your application has been temporarily paused by HR. This may be due to:
            </DialogDescription>
          </DialogHeader>
          
          <div className="my-4 space-y-2 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <span>HR team reviewing your request or concerns</span>
            </div>
          </div>
          
          <p className="text-sm text-gray-500 text-center">
            Please wait while HR reviews your application. 
            You will be notified when your application resumes.
          </p>
        </DialogContent>
      </Dialog>

      <CurrentStepComponent 
        data={caseData} 
        onNext={handleNext} 
        onBack={handleBack}
        isPaused={isPaused}
      />
    </WizardShell>
  );
}
