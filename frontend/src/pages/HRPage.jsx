import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { hrLogin, createCase, generateApplicationCode, listCases, deleteCase, resumeCase, updateCase, listEmployees, getEmployeeDetails, updateEmployeeAssets, runOrchestrator } from "@/lib/mockApi";
import { Trash2, Play, Pencil, Briefcase, Users, Download, Laptop, MapPin, FileText, ChevronDown, ChevronRight, User, CheckCircle2, Clock, AlertCircle, XCircle, PauseCircle, TrendingUp, FileStack } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

export function HRPage() {
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const [username, setUsername] = useState("hr");
  const [password, setPassword] = useState("admin");

  // Menu state
  const [casesOpen, setCasesOpen] = useState(true);
  const [employeesOpen, setEmployeesOpen] = useState(false);
  const [activeView, setActiveView] = useState("cases"); // 'cases' | 'employees'

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

  // Employees state
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [assetEditOpen, setAssetEditOpen] = useState(false);
  const [assetForm, setAssetForm] = useState({ laptop: {}, seat: {} });

  const loadCases = async () => {
    try {
      const data = await listCases();
      setCases(Array.isArray(data) ? data : []);
    } catch {
      setCases([]);
    }
  };

  const loadEmployees = async () => {
    try {
      const data = await listEmployees();
      setEmployees(Array.isArray(data) ? data : []);
    } catch {
      setEmployees([]);
    }
  };

  const loadEmployeeDetails = async (employeeId) => {
    try {
      const data = await getEmployeeDetails(employeeId);
      setSelectedEmployee(data);
    } catch {
      setSelectedEmployee(null);
    }
  };

  useEffect(() => {
    if (authed) {
      loadCases();
      loadEmployees();
    }
  }, [authed]);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadEmployeeDetails(selectedEmployeeId);
    } else {
      setSelectedEmployee(null);
    }
  }, [selectedEmployeeId]);

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
          <div className="flex gap-6">
            {/* Sidebar with collapsible menus */}
            <div className="w-64 shrink-0">
              <Card className="shadow-md border-gray-100 sticky top-24">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Navigation</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  {/* Cases Collapsible Menu */}
                  <Collapsible>
                    <CollapsibleTrigger
                      isOpen={casesOpen}
                      onClick={() => {
                        setCasesOpen(!casesOpen);
                        if (!casesOpen) {
                          setActiveView("cases");
                          setEmployeesOpen(false);
                        }
                      }}
                      icon={Briefcase}
                    >
                      Cases
                    </CollapsibleTrigger>
                    <CollapsibleContent isOpen={casesOpen}>
                      <button
                        onClick={() => setActiveView("cases")}
                        className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                          activeView === "cases" ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-600"
                        }`}
                      >
                        Create Onboarding Case
                      </button>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Employees Collapsible Menu */}
                  <Collapsible>
                    <CollapsibleTrigger
                      isOpen={employeesOpen}
                      onClick={() => {
                        setEmployeesOpen(!employeesOpen);
                        if (!employeesOpen) {
                          setActiveView("employees");
                          setCasesOpen(false);
                        }
                      }}
                      icon={Users}
                    >
                      Employees
                    </CollapsibleTrigger>
                    <CollapsibleContent isOpen={employeesOpen}>
                      <div className="space-y-1 max-h-64 overflow-auto">
                        {employees.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-500">No employees yet</div>
                        ) : (
                          employees.map((emp) => (
                            <button
                              key={emp.employee_id}
                              onClick={() => {
                                setSelectedEmployeeId(emp.employee_id);
                                setActiveView("employee-detail");
                              }}
                              className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                                selectedEmployeeId === emp.employee_id && activeView === "employee-detail"
                                  ? "bg-blue-50 text-blue-700"
                                  : "hover:bg-gray-50 text-gray-600"
                              }`}
                            >
                              <div className="font-medium truncate">{emp.full_name}</div>
                              <div className="text-xs text-gray-400 truncate">{emp.role}</div>
                            </button>
                          ))
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
              {activeView === "cases" && (
                <CasesView
                  form={form}
                  setForm={setForm}
                  startDateError={startDateError}
                  handleStartDateChange={handleStartDateChange}
                  authErr={authErr}
                  busy={busy}
                  setBusy={setBusy}
                  onCreate={onCreate}
                  cases={cases}
                  selectedCaseId={selectedCaseId}
                  setSelectedCaseId={setSelectedCaseId}
                  setGeneratedCode={setGeneratedCode}
                  onDelete={onDelete}
                  loadCases={loadCases}
                  loadEmployees={loadEmployees}
                  selected={selected}
                  setEditForm={setEditForm}
                  setEditOpen={setEditOpen}
                  onGenerate={onGenerate}
                  onResume={onResume}
                />
              )}

              {activeView === "employees" && (
                <Card className="shadow-md border-gray-100">
                  <CardHeader>
                    <CardTitle>Employees</CardTitle>
                    <CardDescription>Select an employee from the sidebar to view their details</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {employees.map((emp) => (
                        <Card
                          key={emp.employee_id}
                          className="cursor-pointer hover:border-blue-300 transition-colors"
                          onClick={() => {
                            setSelectedEmployeeId(emp.employee_id);
                            setActiveView("employee-detail");
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-gray-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{emp.full_name}</div>
                                <div className="text-sm text-gray-500 truncate">{emp.role}</div>
                              </div>
                            </div>
                            <div className="mt-3">
                              <Badge variant={
                                emp.status === "ONBOARDING_COMPLETE" ? "success" :
                                emp.status === "ONBOARDING_IN_PROGRESS" ? "default" :
                                "secondary"
                              }>
                                {emp.status?.replace(/_/g, " ") || "PENDING"}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeView === "employee-detail" && selectedEmployee && (
                <EmployeeDetailView
                  employee={selectedEmployee}
                  onBack={() => {
                    setSelectedEmployeeId(null);
                    setActiveView("employees");
                  }}
                  busy={busy}
                  setBusy={setBusy}
                  assetEditOpen={assetEditOpen}
                  setAssetEditOpen={setAssetEditOpen}
                  assetForm={assetForm}
                  setAssetForm={setAssetForm}
                  loadEmployees={loadEmployees}
                  loadEmployeeDetails={loadEmployeeDetails}
                />
              )}
            </div>
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

// CasesView Component - Shows the Create Onboarding Case form and cases list
function CasesView({
  form,
  setForm,
  startDateError,
  handleStartDateChange,
  authErr,
  busy,
  setBusy,
  onCreate,
  cases,
  selectedCaseId,
  setSelectedCaseId,
  setGeneratedCode,
  onDelete,
  loadCases,
  loadEmployees,
  selected,
  setEditForm,
  setEditOpen,
  onGenerate,
  onResume,
}) {
  // Dashboard metrics calculation
  const metrics = useMemo(() => {
    const total = cases.length;
    const onHold = cases.filter(c => 
      c.status === "ON_HOLD_HR" || 
      c.status === "ON_HOLD" || 
      c.status === "NEGOTIATION_PENDING"
    ).length;
    const inProgress = cases.filter(c => 
      c.status?.includes("PROGRESS") || 
      c.status === "SUBMITTED" ||
      c.status === "ONBOARDING_IN_PROGRESS" ||
      c.status === "READY_DAY1" ||
      c.status === "READY_FOR_DAY1" ||
      c.status === "ONBOARDING_COMPLETE" ||
      c.status === "HRIS_COMPLETED"
    ).length;
    const declined = cases.filter(c => c.status === "DECLINED").length;
    const draft = cases.filter(c => !c.status || c.status === "DRAFT").length;
    
    return { total, onHold, inProgress, declined, draft };
  }, [cases]);

  const handleRunOrchestrator = async (caseId) => {
    setBusy(true);
    try {
      const res = await runOrchestrator(caseId);
      if (res.ok || res.plan) {
        const plan = res.plan || res;
        
        // Extract employee ID from case or plan
        const employeeId = plan.day1Readiness?.employeeId || `EMP-${caseId}`;
        
        // Parse laptop model from logistics summary if available
        let laptopModel = "Standard Laptop";
        if (plan.agentSummaries?.logistics) {
          const match = plan.agentSummaries.logistics.match(/Laptop:\s*([^(]+)/);
          if (match) laptopModel = match[1].trim();
        }
        
        // Determine zone based on work location
        const workLocation = selected?.work_location || "";
        const zone = workLocation.toLowerCase().includes("uae") || workLocation.toLowerCase().includes("dubai") ? "A" : "B";
        
        // Update employee assets
        await updateEmployeeAssets(employeeId, {
          laptop: {
            assigned: true,
            model: laptopModel,
            asset_id: `ASSET-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
          },
          seat: {
            assigned: true,
            location: `Floor 1, Zone ${zone}`
          }
        });
        
        await loadCases();
        await loadEmployees();
        alert("Logistics assigned automatically via Orchestrator!");
      }
    } catch (err) {
      console.error("Orchestration failed", err);
      alert("Orchestration failed: " + (err.message || "Unknown error"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      {/* Dashboard Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Cases */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Cases</p>
                <p className="text-3xl font-bold text-blue-900">{metrics.total}</p>
              </div>
              <div className="p-3 bg-blue-200 rounded-full">
                <FileStack className="h-6 w-6 text-blue-700" />
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2">All onboarding cases</p>
          </CardContent>
        </Card>

        {/* In Progress / Submitted */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Submitted</p>
                <p className="text-3xl font-bold text-green-900">{metrics.inProgress}</p>
              </div>
              <div className="p-3 bg-green-200 rounded-full">
                <CheckCircle2 className="h-6 w-6 text-green-700" />
              </div>
            </div>
            <p className="text-xs text-green-600 mt-2">Active & completed</p>
          </CardContent>
        </Card>

        {/* On Hold */}
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600">On Hold</p>
                <p className="text-3xl font-bold text-amber-900">{metrics.onHold}</p>
              </div>
              <div className="p-3 bg-amber-200 rounded-full">
                <PauseCircle className="h-6 w-6 text-amber-700" />
              </div>
            </div>
            <p className="text-xs text-amber-600 mt-2">Awaiting action</p>
          </CardContent>
        </Card>

        {/* Declined */}
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Declined</p>
                <p className="text-3xl font-bold text-red-900">{metrics.declined}</p>
              </div>
              <div className="p-3 bg-red-200 rounded-full">
                <XCircle className="h-6 w-6 text-red-700" />
              </div>
            </div>
            <p className="text-xs text-red-600 mt-2">Offers declined</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-md border-gray-100">
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

      <Card className="shadow-md border-gray-100">
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
          <div className="grid grid-cols-1 gap-4">
            <div className="border rounded-lg bg-white">
              <div className="px-4 py-3 border-b text-sm font-medium text-gray-700">
                Current Cases
              </div>
              <div className="max-h-[300px] overflow-auto">
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

            {selected && (
              <div className="border rounded-lg bg-white">
                <div className="px-4 py-3 border-b text-sm font-medium text-gray-700 flex items-center justify-between">
                  <span>Case Details</span>
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
                </div>
                <div className="p-4 space-y-3">
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
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

// EmployeeDetailView Component - Shows employee details, documents, laptop, and seat
function EmployeeDetailView({
  employee,
  onBack,
  busy,
  setBusy,
  assetEditOpen,
  setAssetEditOpen,
  assetForm,
  setAssetForm,
  loadEmployees,
  loadEmployeeDetails,
}) {
  const steps = employee?.steps || {};
  const assets = employee?.assets || { laptop: {}, seat: {} };

  const Row = ({ label, value }) => (
    <div className="flex justify-between border-b last:border-0 border-gray-100 py-1">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value || "-"}</span>
    </div>
  );

  const Section = ({ title, icon: Icon, children }) => (
    <div className="mb-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" />}
        {title}
      </h3>
      <div className="bg-gray-50 rounded-md p-4 space-y-2 text-sm">{children}</div>
    </div>
  );

  const handleDownloadDocument = (docName) => {
    // Simulate download - in real app this would fetch the actual file
    alert(`Downloading ${docName}... (Demo mode - no actual file)`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          ← Back to Employees
        </Button>
        <Badge variant={
          employee.status === "ONBOARDING_COMPLETE" ? "success" :
          employee.status === "ONBOARDING_IN_PROGRESS" ? "default" :
          "secondary"
        }>
          {employee.status?.replace(/_/g, " ") || "PENDING"}
        </Badge>
      </div>

      <Card className="shadow-md border-gray-100">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-gray-600" />
            </div>
            <div>
              <CardTitle>{employee.full_name}</CardTitle>
              <CardDescription>{employee.role} • {employee.department}</CardDescription>
              <div className="text-sm text-gray-500 mt-1">
                Employee ID: {employee.employee_id} • Start Date: {employee.start_date}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Three Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Offer, Identity, Work Auth */}
            <div className="space-y-4">
              <Section title="Offer Information">
                <Row label="Decision" value={steps.offer?.decision} />
              </Section>

              <Section title="Identity" icon={User}>
                <Row label="Full Name" value={steps.identity?.fullName} />
                <Row label="Email" value={steps.identity?.email} />
                <Row label="Phone" value={steps.identity?.phone} />
                <Row label="Country" value={steps.identity?.country} />
              </Section>

              <Section title="Work Authorization">
                <Row label="Work Location" value={steps.workAuth?.workLocation} />
                <Row label="Sponsorship" value={steps.workAuth?.sponsorship} />
              </Section>
            </div>

            {/* Column 2: Documents */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents
              </h3>
              <div className="space-y-3">
                {steps.documents?.passport && (
                  <div className="p-3 bg-gray-50 rounded-md border">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-sm">{steps.documents.passport.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        {(steps.documents.passport.size / 1024).toFixed(0)} KB
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={steps.documents.passport.status === "verified" ? "success" : "warning"} className="text-xs">
                          {steps.documents.passport.status || "pending"}
                        </Badge>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleDownloadDocument(steps.documents.passport.name)}>
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {steps.documents?.nationalId && (
                  <div className="p-3 bg-gray-50 rounded-md border">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-sm">{steps.documents.nationalId.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        {(steps.documents.nationalId.size / 1024).toFixed(0)} KB
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={steps.documents.nationalId.status === "verified" ? "success" : "warning"} className="text-xs">
                          {steps.documents.nationalId.status || "pending"}
                        </Badge>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleDownloadDocument(steps.documents.nationalId.name)}>
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {steps.documents?.visa && (
                  <div className="p-3 bg-gray-50 rounded-md border">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-sm">{steps.documents.visa.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        {(steps.documents.visa.size / 1024).toFixed(0)} KB
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={steps.documents.visa.status === "verified" ? "success" : "warning"} className="text-xs">
                          {steps.documents.visa.status || "pending"}
                        </Badge>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleDownloadDocument(steps.documents.visa.name)}>
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {!steps.documents?.passport && !steps.documents?.nationalId && !steps.documents?.visa && (
                  <div className="text-gray-500 text-center py-8 bg-gray-50 rounded-md">No documents uploaded</div>
                )}
              </div>
            </div>

            {/* Column 3: Laptop & Seat */}
            <div className="space-y-4">
              {/* Laptop */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <Laptop className="h-4 w-4 text-gray-600" />
                    Laptop
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => {
                      setAssetForm({
                        laptop: {
                          assigned: assets.laptop?.assigned || false,
                          model: assets.laptop?.model || "",
                          asset_id: assets.laptop?.asset_id || ""
                        },
                        seat: assetForm.seat
                      });
                      setAssetEditOpen(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                {assets.laptop?.assigned ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-medium">Assigned</span>
                    </div>
                    <div className="bg-gray-50 rounded-md p-3">
                      <div className="text-xs text-gray-500">Model</div>
                      <div className="font-medium text-sm">{assets.laptop.model}</div>
                      <div className="text-xs text-gray-500 mt-2">Asset ID</div>
                      <div className="font-medium font-mono text-sm">{assets.laptop.asset_id}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>Not yet assigned</span>
                  </div>
                )}
              </div>

              {/* Seat */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-gray-600" />
                    Seat / Desk
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => {
                      setAssetForm({
                        laptop: assetForm.laptop,
                        seat: {
                          assigned: assets.seat?.assigned || false,
                          location: assets.seat?.location || ""
                        }
                      });
                      setAssetEditOpen(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                {assets.seat?.assigned ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-medium">Assigned</span>
                    </div>
                    <div className="bg-gray-50 rounded-md p-3">
                      <div className="text-xs text-gray-500">Location</div>
                      <div className="font-medium text-sm">{assets.seat.location}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>Not yet assigned</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Asset Edit Dialog */}
      <Dialog open={assetEditOpen} onOpenChange={setAssetEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee Assets</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Laptop Form */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Laptop className="h-4 w-4" />
                Laptop
              </h4>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  value={assetForm.laptop?.model || ""}
                  onChange={(e) => setAssetForm((p) => ({
                    ...p,
                    laptop: { ...p.laptop, model: e.target.value, assigned: !!e.target.value }
                  }))}
                  placeholder="e.g., MacBook Pro 14 inch"
                />
              </div>
              <div className="space-y-2">
                <Label>Asset ID</Label>
                <Input
                  value={assetForm.laptop?.asset_id || ""}
                  onChange={(e) => setAssetForm((p) => ({
                    ...p,
                    laptop: { ...p.laptop, asset_id: e.target.value }
                  }))}
                  placeholder="e.g., LAP-2026-0001"
                />
              </div>
            </div>

            <Separator />

            {/* Seat Form */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Seat / Desk
              </h4>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={assetForm.seat?.location || ""}
                  onChange={(e) => setAssetForm((p) => ({
                    ...p,
                    seat: { ...p.seat, location: e.target.value, assigned: !!e.target.value }
                  }))}
                  placeholder="e.g., Floor 3, Desk 12B"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setBusy(true);
                try {
                  await updateEmployeeAssets(employee.employee_id, assetForm);
                  await loadEmployees();
                  await loadEmployeeDetails(employee.employee_id);
                  setAssetEditOpen(false);
                } catch (e) {
                  console.error(e);
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              {busy ? "Saving..." : "Save Assets"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
