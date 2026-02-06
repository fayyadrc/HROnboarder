import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { hrLogin, createCase, generateApplicationCode, listCases } from "@/lib/mockApi";

export function HRPage() {
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const [username, setUsername] = useState("hr");
  const [password, setPassword] = useState("admin");

  const [form, setForm] = useState({
    candidate_name: "",
    role: "",
    nationality: "",
    work_location: "",
    start_date: "",
    salary: "",
    benefits: {},
    prior_notes: ""
  });

  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [generatedCode, setGeneratedCode] = useState(null);

  const loadCases = async () => {
    try {
      const data = await listCases();
      setCases(Array.isArray(data) ? data : []);
    } catch {
      setCases([]);
    }
  };

  useEffect(() => {
    if (authed) loadCases();
  }, [authed]);

  const onAuth = async (e) => {
    e.preventDefault();
    setBusy(true);
    setAuthErr(null);
    try {
      const res = await hrLogin(username, password);
      if (!res?.ok) throw new Error("Invalid credentials");
      setAuthed(true);
    } catch (err) {
      setAuthErr(err?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const onCreate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setAuthErr(null);
    setGeneratedCode(null);
    try {
      const res = await createCase(form);
      if (!res?.case_id) throw new Error("Case creation failed");
      setSelectedCaseId(res.case_id);
      await loadCases();
      setForm({
        candidate_name: "",
        role: "",
        nationality: "",
        work_location: "",
        start_date: "",
        salary: "",
        benefits: {},
        prior_notes: ""
      });
    } catch (err) {
      setAuthErr(err?.message || "Case creation failed");
    } finally {
      setBusy(false);
    }
  };

  const onGenerate = async () => {
    if (!selectedCaseId) return;
    setBusy(true);
    setAuthErr(null);
    setGeneratedCode(null);
    try {
      const res = await generateApplicationCode(selectedCaseId);
      if (!res?.applicationCode) throw new Error("Code generation failed");
      setGeneratedCode(res.applicationCode);
      await loadCases();
    } catch (err) {
      setAuthErr(err?.message || "Code generation failed");
    } finally {
      setBusy(false);
    }
  };

  const selected = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) || null,
    [cases, selectedCaseId]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="font-semibold text-lg tracking-tight text-gray-900">
            HR Automator — HR Admin
          </div>
          <div className="text-sm text-gray-500">
            Hackathon Demo
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {!authed ? (
          <div className="max-w-xl mx-auto">
            <Card className="shadow-md border-gray-100">
              <CardHeader>
                <CardTitle>Login for HR</CardTitle>
                <CardDescription>Use the demo HR credentials to manage onboarding cases.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onAuth} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input value={username} onChange={(e) => setUsername(e.target.value)} disabled={busy} />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
                    </div>
                  </div>

                  {authErr && <div className="text-sm text-red-600 font-medium">{authErr}</div>}

                  <Button type="submit" disabled={busy}>
                    {busy ? "Signing in..." : "Sign in"}
                  </Button>

                  <div className="text-xs text-gray-500">
                    Demo creds: hr / admin
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="shadow-md border-gray-100 lg:col-span-1">
              <CardHeader>
                <CardTitle>Create Onboarding Case</CardTitle>
                <CardDescription>HR creates the case, then generates an application code for the candidate.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Candidate Name</Label>
                    <Input value={form.candidate_name} onChange={(e) => setForm((p) => ({ ...p, candidate_name: e.target.value }))} />
                  </div>

                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Input value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Nationality</Label>
                      <Input value={form.nationality} onChange={(e) => setForm((p) => ({ ...p, nationality: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Work Location</Label>
                      <Input value={form.work_location} onChange={(e) => setForm((p) => ({ ...p, work_location: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} placeholder="2026-03-01" />
                    </div>
                    <div className="space-y-2">
                      <Label>Salary</Label>
                      <Input value={form.salary} onChange={(e) => setForm((p) => ({ ...p, salary: e.target.value }))} placeholder="12000 AED" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Prior Notes</Label>
                    <Input value={form.prior_notes} onChange={(e) => setForm((p) => ({ ...p, prior_notes: e.target.value }))} placeholder="Previous discussion summary..." />
                  </div>

                  {authErr && <div className="text-sm text-red-600 font-medium">{authErr}</div>}

                  <Button type="submit" disabled={busy} className="w-full">
                    {busy ? "Creating..." : "Create Case"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="shadow-md border-gray-100 lg:col-span-2">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Cases</CardTitle>
                  <CardDescription>Select a case and generate an application code.</CardDescription>
                </div>
                <Button variant="outline" onClick={loadCases} disabled={busy}>
                  Refresh
                </Button>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg bg-white">
                    <div className="px-4 py-3 border-b text-sm font-medium text-gray-700">
                      Current Cases
                    </div>
                    <div className="max-h-[360px] overflow-auto">
                      {cases.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">No cases yet.</div>
                      ) : (
                        cases.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedCaseId(c.id);
                              setGeneratedCode(null);
                            }}
                            className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 ${
                              selectedCaseId === c.id ? "bg-gray-50" : ""
                            }`}
                          >
                            <div className="text-sm font-semibold text-gray-900">
                              {c.candidate_name || "Unnamed Candidate"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {c.id} • {c.role || "No role"} • {c.status || "DRAFT"}
                            </div>
                            <div className="mt-2">
                              <Badge variant="secondary">{c.status || "DRAFT"}</Badge>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="border rounded-lg bg-white">
                    <div className="px-4 py-3 border-b text-sm font-medium text-gray-700">
                      Case Details
                    </div>
                    <div className="p-4 space-y-3">
                      {!selected ? (
                        <div className="text-sm text-gray-500">Select a case to view details.</div>
                      ) : (
                        <>
                          <div className="text-sm">
                            <div className="text-xs text-gray-500">Candidate</div>
                            <div className="font-medium">{selected.candidate_name}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <div className="text-xs text-gray-500">Role</div>
                              <div className="font-medium">{selected.role || "-"}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Salary</div>
                              <div className="font-medium">{selected.salary || "-"}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Nationality</div>
                              <div className="font-medium">{selected.nationality || "-"}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Location</div>
                              <div className="font-medium">{selected.work_location || "-"}</div>
                            </div>
                          </div>

                          <Separator />

                          {!selected.applicationCode ? (
                            <Button onClick={onGenerate} disabled={busy} className="w-full">
                              {busy ? "Generating..." : "Generate Application Code"}
                            </Button>
                          ) : (
                            <div className="text-xs text-gray-600">Application code already generated.</div>
                          )}

                          {(generatedCode || selected.applicationCode) && (
                            <div className="rounded-md border border-green-200 bg-green-50 p-3">
                              <div className="text-xs text-green-700">Application Code</div>
                              <div className="font-mono text-lg font-semibold text-green-900">
                                {generatedCode || selected.applicationCode}
                              </div>
                              <div className="text-xs text-green-700 mt-1">
                                Candidate enters this on the main login page.
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  Next milestone: laptop inventory + seating plan tabs (HR-only), plus real email sending.
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
