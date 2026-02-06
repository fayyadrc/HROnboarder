import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/mockApi";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, FileIcon } from "lucide-react";

const DocUpload = ({ label, id, file, result, onUpload, disabled }) => {
  return (
    <div className="border rounded-lg p-4 space-y-3 bg-white">
      <div className="flex justify-between items-start">
        <Label htmlFor={id} className="text-base font-medium">{label}</Label>
        {result && (
           <Badge variant={result.status === 'success' ? 'default' : (result.status === 'warning' ? 'secondary' : 'destructive')}>
             {result.message}
           </Badge>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Input 
            id={id} 
            type="file" 
            accept=".pdf,.jpg,.png" 
            onChange={(e) => onUpload(id, e.target.files[0])} 
            className="cursor-pointer"
            disabled={disabled}
        />
      </div>
      
      {file && (
        <div className="flex items-center text-sm text-gray-600 bg-gray-50 p-2 rounded">
           <FileIcon className="w-4 h-4 mr-2" />
           <span className="truncate max-w-[200px]">{file.name}</span>
           <span className="ml-2 text-xs text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
        </div>
      )}
    </div>
  );
};

export function StepDocuments({ data, onNext, onBack, isPaused }) {
  // Restore state from data if available, though file objects cannot be truly restored from localStorage
  // We will assume if data exists in localStorage, we show "File uploaded" state visually but can't restore File object.
  // For this mock, we'll store metadata in localStorage and just show it.
  
  const savedData = data.steps.documents || {};
  
  const [uploads, setUploads] = useState({
      passport: savedData.passport || null,
      nationalId: savedData.nationalId || null,
      visa: savedData.visa || null
  });

  const [results, setResults] = useState(savedData.analysisResults || {});
  const [analyzing, setAnalyzing] = useState(false);

  // Helper to simulate "file" if we just have metadata
  const getFileDisplay = (key) => {
      const data = uploads[key];
      if (!data) return null;
      // If it has 'name', it's our metadata object. If it's a File, it has 'name'.
      return data;
  };

  const handleUpload = (key, file) => {
      if (!file) return;
      // Store basic metadata
      setUploads(prev => ({
          ...prev,
          [key]: { name: file.name, size: file.size, type: file.type }
      }));
      // Reset result for this file
      setResults(prev => ({ ...prev, [key]: null }));
  };

  const handleSubmit = async () => {
    // Validate required
    if (!uploads.passport || !uploads.nationalId) {
        alert("Passport and National ID are required.");
        return;
    }

    setAnalyzing(true);
    
    // Simulate multiple requests
    try {
        const newResults = {...results};
        
        // Only analyze new uploads or if no result yet
        if (!newResults.passport) newResults.passport = await api.simulateDocAnalysis();
        if (!newResults.nationalId) newResults.nationalId = await api.simulateDocAnalysis();
        if (uploads.visa && !newResults.visa) newResults.visa = await api.simulateDocAnalysis();

        setResults(newResults);
        
        // Wait a bit to show results
        setTimeout(() => {
            onNext("documents", { 
                passport: uploads.passport, 
                nationalId: uploads.nationalId, 
                visa: uploads.visa,
                analysisResults: newResults 
            }, 4);
        }, 1000); // Give user time to see badges? Or allow manual Next?
        // Prompt says: "On Next, mock classification... with delay... status badges".
        // This implies clicking Next triggers it. But if badges appear, do we auto-advance or let user see them?
        // "Show a small 'Analysis result' summary... but keep it simple."
        // Let's stop at badges and let user click Next again? Or just advance?
        // "Validation: Required fields must be present for Next."
        // Let's assume Next triggers analysis AND saving. 
        // If results are bad, maybe we block? "Low quality", "Wrong doc".
        // Let's auto-advance for flow smoothness unless user wants to retry. 
        // We'll advance immediately after analysis.
        
    } catch(e) {
        console.error(e);
    } finally {
        setAnalyzing(false);
    }
  };

  return (
    <Card className="shadow-md border-gray-100">
      <CardHeader>
        <CardTitle>Identity Documents</CardTitle>
        <CardDescription>Please upload your identification documents for verification.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <DocUpload 
            id="passport" 
            label="Passport (Required)" 
            file={getFileDisplay('passport')} 
            result={results.passport} 
            onUpload={handleUpload}
            disabled={isPaused}
        />
        <DocUpload 
            id="nationalId" 
            label="National ID (Required)" 
            file={getFileDisplay('nationalId')} 
            result={results.nationalId} 
             onUpload={handleUpload}
             disabled={isPaused}
        />
        <DocUpload 
            id="visa" 
            label="Visa / Residency Permit (Optional)" 
            file={getFileDisplay('visa')} 
            result={results.visa} 
             onUpload={handleUpload}
             disabled={isPaused}
        />
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={handleSubmit} disabled={analyzing || !uploads.passport || !uploads.nationalId || isPaused}>
          {analyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {analyzing ? "Analyzing..." : "Next"}
        </Button>
      </CardFooter>
    </Card>
  );
}
