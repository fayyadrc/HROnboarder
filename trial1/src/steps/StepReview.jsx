import React, { useMemo, useState } from "react";
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
  const [submitted, setSubmitted] = useState(data?.status === "SUBMITTED_FOR_HR_REVIEW");

  const [runningAgents, setRunningAgents] = useState(false);
  const [agentPlan, setAgentPlan] = useState(null);
  const [agentError, setAgentError] = useState("");

  const steps = useMemo(() => data?.steps || {}, [data]);

  const Row = ({ label, value }) => (
    <div className="flex justify-between border-b last:border-0 border-gray-100 py-1">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value || "-"}</span>
    </div>
  );

  const Section = ({ title, children }) => (
    <div className="mb-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">{title}</h3>
      <div className="bg-gray-50 rounded-md p-4 space-y-2 text-sm">{children}</div>
    </div>
  );

  const handleRunAgents = async () => {
    setAgentError("");
    setRunningAgents(true);
    try {
      const res = await api.runAgents("Run from Review step");
      setAgentPlan(res?.plan || null);
    } catch (e) {
      setAgentError(e?.message || "Failed to run agents");
    } finally {
      setRunningAgents(false);
    }
  };

  const handleSubmit = async () => {
    if (!attested) return;
    setSubmitting(true);
    try {
      // Run agents first
      setAgentError("");
      setRunningAgents(true);
      try {
        const res = await api.runAgents("Run from Submit");
        setAgentPlan(res?.plan || null);
      } catch (e) {
        setAgentError(e?.message || "Failed to run agents");
      } finally {
        setRunningAgents(false);
      }

      // Then submit the application
      await api.setStatus("ONBOARDING_IN_PROGRESS");
      await api.submitStep("review", { attested: true, submittedAt: new Date().toISOString() }, 6);
      setSubmitted(true);
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
            HR will review your details and contact you if needed.
            <br />
            You can close this window.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-md border-gray-100">
      <CardHeader>
        <CardTitle>Review</CardTitle>
        <CardDescription>Please ensure all information is accurate before submitting.</CardDescription>
      </CardHeader>

      <CardContent>
        {/* Agent run section */}
        <div className="mb-6 p-4 rounded-md border bg-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold">Run AI Agents</div>
              <div className="text-sm text-gray-600">
                Orchestrator runs Compliance + Logistics and generates a Day-1 readiness plan.
              </div>
            </div>
            <Button onClick={handleRunAgents} disabled={runningAgents || isPaused} className="bg-gray-900 hover:bg-gray-800">
              {runningAgents && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Run Agents
            </Button>
          </div>

          {agentError && <div className="mt-3 text-sm text-red-600">{agentError}</div>}

          {agentPlan && (
            <div className="mt-4 text-sm">
              <Separator className="my-3" />
              <Row label="Overall Status" value={agentPlan.overallStatus} />
              <Row label="Compliance" value={agentPlan.agentSummaries?.compliance} />
              <Row label="Logistics" value={agentPlan.agentSummaries?.logistics} />

              {agentPlan.conflicts?.length > 0 && (
                <div className="mt-3 p-3 rounded-md border border-amber-200 bg-amber-50">
                  <div className="font-semibold text-amber-900">Conflicts</div>
                  <ul className="list-disc pl-5 mt-2 space-y-1 text-amber-900">
                    {agentPlan.conflicts.map((c, i) => (
                      <li key={i}>
                        {c.message} — <span className="font-medium">{c.suggestedResolution}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Existing review sections */}
        <Section title="Offer">
          <Row label="Decision" value={steps.offer?.decision} />
        </Section>

        <Section title="Identity">
          <Row label="Full Name" value={steps.identity?.fullName} />
          <Row label="Email" value={steps.identity?.email} />
          <Row label="Phone" value={steps.identity?.phone} />
          <Row label="Country" value={steps.identity?.country} />
        </Section>

        <Section title="Documents">
          <Row label="Passport" value={steps.documents?.passport?.name || (steps.documents?.passport ? "Uploaded" : "-")} />
          <Row
            label="National ID"
            value={steps.documents?.nationalId?.name || (steps.documents?.nationalId ? "Uploaded" : "-")}
          />
          <Row
            label="Visa"
            value={steps.documents?.visa?.name || (steps.documents?.visa ? "Uploaded" : "-")}
          />
        </Section>

        <Section title="Work Authorization">
          <Row
            label="Work Location"
            value={steps.workAuth?.workLocation || "-"}
          />
          <Row label="Sponsorship" value={steps.workAuth?.sponsorship} />
        </Section>

        <Separator className="my-6" />

        <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-md border border-blue-100">
          <Checkbox id="attest" checked={attested} onCheckedChange={setAttested} />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="attest" className="text-sm font-medium leading-relaxed text-blue-900">
              I attest that the information provided in this application is accurate and complete to the best of my knowledge.
            </Label>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!attested || submitting || isPaused}
          className="bg-green-600 hover:bg-green-700"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Application
        </Button>
      </CardFooter>
    </Card>
  );
}
