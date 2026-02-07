import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { hrLogin, createCase, generateApplicationCode, listCases, deleteCase, resumeCase, updateCase } from "@/lib/mockApi";
import { Trash2, Play, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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
  const [startDateError, setStartDateError] = useState(null);

  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});

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

  // Validate start date is not before current date
  const validateStartDate = (dateString) => {
    if (!dateString) {
      setStartDateError(null);
      return true;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(dateString);
    if (selectedDate < today) {
      setStartDateError("Start date cannot be before today");
      return false;
    }
    setStartDateError(null);
    return true;
  };

  const handleStartDateChange = (e) => {
    const newDate = e.target.value;
    setForm((p) => ({ ...p, start_date: newDate }));
    validateStartDate(newDate);
  };

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
    
    // Validate start date before submission
    if (form.start_date && !validateStartDate(form.start_date)) {
      return;
    }
    
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
      setStartDateError(null);
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

  const onDelete = async (caseId, e) => {
    e.stopPropagation(); // Prevent selecting the case
    if (!confirm("Are you sure you want to delete this case?")) return;
    setBusy(true);
    setAuthErr(null);
    try {
      await deleteCase(caseId);
      if (selectedCaseId === caseId) {
        setSelectedCaseId(null);
        setGeneratedCode(null);
      }
      await loadCases();
    } catch (err) {
      setAuthErr(err?.message || "Failed to delete case");
    } finally {
      setBusy(false);
    }
  };

  const onResume = async () => {
    if (!selectedCaseId) return;
    setBusy(true);
    setAuthErr(null);
    try {
      await resumeCase(selectedCaseId);
      await loadCases();
    } catch (err) {
      setAuthErr(err?.message || "Failed to resume case");
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
                      <Input 
                        type="date" 
                        value={form.start_date} 
                        onChange={handleStartDateChange} 
                        min={new Date().toISOString().split('T')[0]}
                        placeholder="2026-03-01" 
                      />
                      {startDateError && (
                        <p className="text-xs text-red-500">{startDateError}</p>
                      )}
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
                          <div
                            key={c.id}
                            onClick={() => {
                              setSelectedCaseId(c.id);
                              setGeneratedCode(null);
                            }}
                            className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer ${
                              selectedCaseId === c.id ? "bg-gray-50" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-900">
                                  {c.candidate_name || "Unnamed Candidate"}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {c.id} • {c.role || "No role"}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => onDelete(c.id, e)}
                                className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                                title="Delete case"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="mt-2">
                              <Badge variant={
                                c.status === "DECLINED" ? "destructive" :
                                c.status?.includes("PROGRESS") || c.status === "ONBOARDING_IN_PROGRESS" ? "success" :
                                c.status === "ON_HOLD_HR" || c.status === "ON_HOLD" || c.status === "NEGOTIATION_PENDING" ? "warning" :
                                "secondary"
                              }>
                                {c.status || "DRAFT"}
                              </Badge>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="border rounded-lg bg-white">
                    <div className="px-4 py-3 border-b text-sm font-medium text-gray-700 flex items-center justify-between">
                      <span>Case Details</span>
                      {selected && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setEditForm({
                              candidate_name: selected.candidate_name || "",
                              role: selected.role || "",
                              nationality: selected.nationality || "",
                              work_location: selected.work_location || "",
                              salary: selected.salary || "",
                            });
                            setEditOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      {!selected ? (
                        <div className="text-sm text-gray-500">Select a case to view details.</div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <div className="text-xs text-gray-500">Candidate</div>
                              <div className="font-medium">{selected.candidate_name}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Application Code</div>
                              <div className="font-mono font-medium text-green-700">
                                {selected.applicationCode || (
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={onGenerate} 
                                    disabled={busy}
                                    className="h-6 px-2 text-xs"
                                  >
                                    Generate
                                  </Button>
                                )}
                              </div>
                            </div>
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

                          {/* Candidate Feedback Section */}
                          {(selected.candidate_concerns || selected.salary_appeal) && (
                            <div className="space-y-3">
                              <div className="text-sm font-medium text-gray-700">Candidate Feedback</div>
                              
                              {selected.candidate_concerns && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                                  <div className="text-xs text-amber-700 font-medium">Concerns</div>
                                  <div className="text-sm text-amber-900 mt-1">
                                    {selected.candidate_concerns}
                                  </div>
                                </div>
                              )}
                              
                              {selected.salary_appeal && (
                                <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                                  <div className="text-xs text-blue-700 font-medium">Salary Appeal</div>
                                  <div className="text-sm text-blue-900 mt-1">
                                    {selected.salary_appeal}
                                  </div>
                                </div>
                              )}
                              
                              <Separator />
                            </div>
                          )}

                          {/* Resume button for paused applications */}
                          {(selected.status === "ON_HOLD_HR" || selected.status === "ON_HOLD") && (
                            <Button 
                              onClick={onResume} 
                              disabled={busy} 
                              className="w-full bg-green-600 hover:bg-green-700"
                            >
                              <Play className="w-4 h-4 mr-2" />
                              {busy ? "Resuming..." : "Resume Application"}
                            </Button>
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

        {/* Edit Case Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Case Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Candidate Name</Label>
                <Input
                  value={editForm.candidate_name || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, candidate_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input
                  value={editForm.role || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Nationality</Label>
                <Input
                  value={editForm.nationality || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, nationality: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Work Location</Label>
                <Input
                  value={editForm.work_location || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, work_location: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Salary</Label>
                <Input
                  value={editForm.salary || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, salary: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!selected) return;
                  setBusy(true);
                  try {
                    await updateCase(selected.id, editForm);
                    await loadCases();
                    setEditOpen(false);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
              >
                {busy ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
