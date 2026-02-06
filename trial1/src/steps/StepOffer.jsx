import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/mockApi";
import { Loader2 } from "lucide-react";

export function StepOffer({ data, onNext, onBack, isPaused }) {
  const [decision, setDecision] = useState(data.steps.offer?.decision || "");
  const [concerns, setConcerns] = useState(data.steps.offer?.concerns || "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    let nextStatus = data.status;
    let nextStep = 2; // Default proceed

    if (decision === "decline") {
      // Terminal UI handled locally or state update
      // We'll proceed to next step but status will block further progress ideally?
      // Or just remain here with a message?
      // "If Decline -> show terminal UI message... Disable Next"
      // Let's updated state to local "declined" view or set status.
      // But prompt says "Disable Next". So we likely don't move to step 2.
    } else if (decision === "concern") {
      nextStatus = "NEGOTIATION_PENDING";
      // "show the pause banner (disable Next); but allow Back and viewing other steps."
      // So we technically stay on this step or allow browsing? 
      // "Viewing other steps" implies we might not enforce strictly linear if passed?
      // But we are at Step 1.
      // We should save this state.
    }

    // Call Mock API directly for status update if needed, mockApi.submitStep handles payload.
    // Special handling involves `setStatus` likely.

    if (decision === "concern") {
       await api.setStatus("NEGOTIATION_PENDING");
    }

    // Save step data
    onNext("offer", { decision, concerns }, decision === 'decline' ? 1 : (decision === 'concern' ? 1 : 2));
    setSubmitting(false);
  };

  // Terminal state for Decline
  if (decision === "decline" && data.steps.offer?.decision === "decline") { // If saved as decline
     return (
        <Card className="shadow-md border-red-100 mt-10">
            <CardHeader className="text-center">
                <CardTitle className="text-red-700">Offer Declined</CardTitle>
                <CardDescription>
                    Thanks for your response. HR will follow up with you shortly regarding your decision.
                </CardDescription>
            </CardHeader>
        </Card>
     )
  }

  return (
    <Card className="shadow-md border-gray-100">
      <CardHeader>
        <CardTitle>Offer Confirmation</CardTitle>
        <CardDescription>Please review your offer details and indicate your decision.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Decision</Label>
          <RadioGroup value={decision} onValueChange={setDecision} disabled={isPaused}>
            <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-gray-50 transition-colors">
              <RadioGroupItem value="accept" id="accept" />
              <Label htmlFor="accept" className="cursor-pointer flex-1">Accept Offer</Label>
            </div>
            <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-gray-50 transition-colors">
              <RadioGroupItem value="concern" id="concern" />
              <Label htmlFor="concern" className="cursor-pointer flex-1">Accept, but I have concerns</Label>
            </div>
            <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-red-50 border-red-100 transition-colors">
              <RadioGroupItem value="decline" id="decline" />
              <Label htmlFor="decline" className="cursor-pointer flex-1 text-red-600">Decline Offer</Label>
            </div>
          </RadioGroup>
        </div>

        {decision === "concern" && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <Label htmlFor="concerns">What concerns do you have?</Label>
            <Textarea 
              id="concerns" 
              placeholder="Please describe your concerns regarding salary, start date, etc..." 
              value={concerns}
              onChange={(e) => setConcerns(e.target.value)}
              disabled={isPaused}
            />
          </div>
        )}
        
        {decision === "decline" && (
            <div className="p-3 bg-red-50 text-red-800 text-sm rounded-md">
                Declining the offer will notify HR and end this onboarding session.
            </div>
        )}

      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button 
            onClick={handleSubmit} 
            disabled={!decision || (decision === 'concern' && !concerns) || submitting || isPaused}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Next
        </Button>
      </CardFooter>
    </Card>
  );
}
