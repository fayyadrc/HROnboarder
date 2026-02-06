import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/mockApi";
import { Loader2, CheckCircle2 } from "lucide-react";

export function StepReview({ data, onNext, onBack, isPaused }) {
  const [attested, setAttested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(data.status === 'SUBMITTED_FOR_HR_REVIEW');

  const handleSubmit = async () => {
    if (!attested) return;
    setSubmitting(true);
    try {
        await api.setStatus("SUBMITTED_FOR_HR_REVIEW");
        setSubmitted(true);
        // We might also update step status to complete
        await api.submitStep("review", { attested: true, submittedAt: new Date().toISOString() }, 6);
    } catch (e) {
        console.error(e);
    } finally {
        setSubmitting(false);
    }
  };

  if (submitted) {
     return (
        <Card className="shadow-lg border-green-100 mt-10">
            <CardHeader className="text-center pb-10 pt-10">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-10 h-10" />
                </div>
                <CardTitle className="text-2xl text-green-800">Application Submitted</CardTitle>
                <CardDescription className="text-lg pt-2">
                    HR will review your details and contact you if needed.<br/>
                    You can close this window.
                </CardDescription>
            </CardHeader>
        </Card>
     );
  }

  // Helper to show sections
  const Section = ({ title, children }) => (
      <div className="mb-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">{title}</h3>
          <div className="bg-gray-50 rounded-md p-4 space-y-2 text-sm">
              {children}
          </div>
      </div>
  );

  const Row = ({ label, value }) => (
      <div className="flex justify-between border-b last:border-0 border-gray-100 py-1">
          <span className="text-gray-600">{label}</span>
          <span className="font-medium text-gray-900">{value || "-"}</span>
      </div>
  );

  const steps = data.steps;

  return (
    <Card className="shadow-md border-gray-100">
      <CardHeader>
        <CardTitle>Final Review</CardTitle>
        <CardDescription>Please ensure all information is accurate before submitting.</CardDescription>
      </CardHeader>
      <CardContent>
         <Section title="Use of Offer">
             <Row label="Decision" value={steps.offer?.decision} />
             {steps.offer?.concerns && <Row label="Concerns" value="Noted" />}
         </Section>

         <Section title="Identity">
             <Row label="Full Name" value={steps.identity?.fullName} />
             <Row label="Email" value={steps.identity?.email} />
             <Row label="Phone" value={steps.identity?.phone} />
             <Row label="Country" value={steps.identity?.country} />
         </Section>

         <Section title="Documents">
             <Row label="Passport" value={steps.documents?.passport?.name || "Uploaded"} />
             <Row label="National ID" value={steps.documents?.nationalId?.name || "Uploaded"} />
         </Section>

          <Section title="Work Authorized">
             <Row label="Location" value={`${steps.workAuth?.workCity}, ${steps.workAuth?.workCountry}`} />
             <Row label="Visa Status" value={steps.workAuth?.visaStatus} />
             <Row label="Sponsorship" value={steps.workAuth?.sponsorship} />
         </Section>
         
         <Separator className="my-6" />

         <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-md border border-blue-100">
            <Checkbox 
                id="attest" 
                checked={attested} 
                onCheckedChange={setAttested}
                disabled={isPaused}
            />
            <div className="grid gap-1.5 leading-none">
                <Label htmlFor="attest" className="text-sm font-medium leading-relaxed text-blue-900">
                    I attest that the information provided in this application is accurate and complete to the best of my knowledge.
                </Label>
            </div>
         </div>
         
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={handleSubmit} disabled={!attested || submitting || isPaused} className="bg-green-600 hover:bg-green-700">
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Application
        </Button>
      </CardFooter>
    </Card>
  );
}
