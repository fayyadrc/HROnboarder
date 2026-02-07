import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/mockApi";
import { Loader2, MessageSquare, Clock } from "lucide-react";

export function StepOffer({ data, onNext, onBack, isPaused, onStatusChange }) {
  const [decision, setDecision] = useState(data.steps.offer?.decision || "");
  const [concerns, setConcerns] = useState(data.steps.offer?.concerns || "");
  const [salaryAppeal, setSalaryAppeal] = useState(data.steps.offer?.salaryAppeal || "");
  const [showSalaryAppeal, setShowSalaryAppeal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [appealSubmitted, setAppealSubmitted] = useState(
    data.steps.offer?.salaryAppeal && data.status === "ON_HOLD_HR"
  );
  const [concernsSubmitted, setConcernsSubmitted] = useState(
    data.steps.offer?.decision === "concern" && data.status === "ON_HOLD_HR"
  );
  const salary =
    data?.seed?.compensation?.salary ||
    data?.seed?.salary ||
    "";

  const handleSalaryAppealSubmit = async () => {
    if (!salaryAppeal.trim()) return;
    setSubmitting(true);
    try {
      const payload = { decision: decision || "appeal", salaryAppeal };
      await api.setStatus("ON_HOLD_HR");
      await api.submitStep("offer", payload, 1); // Stay on offer step
      setAppealSubmitted(true);
      // Reload to refresh status and show paused state
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = { decision, concerns, salaryAppeal };
      
      if (decision === "concern") {
        await api.setStatus("ON_HOLD_HR");
        // Stay on offer step (step 1), don't advance
        await api.submitStep("offer", payload, 1);
        setConcernsSubmitted(true);
        // Reload to refresh status
        window.location.reload();
        return;
      }

      if (decision === "decline") {
        await api.setStatus("DECLINED");
        await api.submitStep("offer", payload, null);
        // Reload to show declined state
        window.location.reload();
        return;
      }

      // Accept offer
      await api.submitStep("offer", payload, 2);
      onNext("offer", payload, 2);
    } finally {
      setSubmitting(false);
    }
  };

  // Terminal state for Decline
  if (decision === "decline" && data.status === "DECLINED") { // If saved as decline
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

  // Waiting for HR review state (concerns or salary appeal)
  if (isPaused && (data.steps.offer?.decision === "concern" || data.steps.offer?.salaryAppeal)) {
    return (
      <Card className="shadow-md border-amber-200 bg-amber-50">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
          <CardTitle className="text-amber-800">Under HR Review</CardTitle>
          <CardDescription className="text-amber-700">
            {data.steps.offer?.salaryAppeal 
              ? "Your salary appeal has been submitted to HR for review."
              : "Your concerns have been submitted to HR for review."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.steps.offer?.concerns && (
            <div className="p-4 bg-white rounded-lg border border-amber-200">
              <div className="text-sm font-medium text-gray-700 mb-2">Your submitted concerns:</div>
              <p className="text-sm text-gray-600">{data.steps.offer?.concerns}</p>
            </div>
          )}
          
          {data.steps.offer?.salaryAppeal && (
            <div className="p-4 bg-white rounded-lg border border-blue-200">
              <div className="text-sm font-medium text-gray-700 mb-2">Salary appeal request:</div>
              <p className="text-sm text-gray-600">{data.steps.offer?.salaryAppeal}</p>
            </div>
          )}
          
          <p className="text-sm text-center text-amber-700">
            HR will review your request and get back to you. 
            Once approved, you'll be able to continue with your application.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md border-gray-100">
      <CardHeader>
        <CardTitle>Offer Confirmation</CardTitle>
        <CardDescription>Please review your offer details and indicate your decision.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {salary && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Offered Salary</div>
                <div className="text-lg font-semibold text-gray-900">{salary}</div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSalaryAppeal(!showSalaryAppeal)}
                disabled={isPaused}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {showSalaryAppeal ? "Hide Appeal" : "Appeal Salary"}
              </Button>
            </div>
            
            {showSalaryAppeal && (
              <div className="mt-4 pt-4 border-t border-gray-200 animate-in fade-in slide-in-from-top-2">
                <Label htmlFor="salaryAppeal" className="text-sm font-medium text-gray-700">
                  Salary Appeal Request
                </Label>
                <p className="text-xs text-gray-500 mb-2">
                  Explain your desired salary and reasoning. HR will review your request.
                </p>
                <Textarea 
                  id="salaryAppeal" 
                  placeholder="e.g., Based on my experience and market rates, I would like to request a salary of..." 
                  value={salaryAppeal}
                  onChange={(e) => setSalaryAppeal(e.target.value)}
                  disabled={isPaused || submitting}
                  className="min-h-[80px]"
                />
                <Button 
                  className="mt-3 w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleSalaryAppealSubmit}
                  disabled={!salaryAppeal.trim() || isPaused || submitting}
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Request
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Your application will be paused until HR reviews your request.
                </p>
              </div>
            )}
          </div>
        )}

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
            You have declined the offer. HR will contact you.
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
