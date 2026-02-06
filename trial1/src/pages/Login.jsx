import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/mockApi";
import { Loader2 } from "lucide-react";

export function LoginPage() {
  const [appNumber, setAppNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!appNumber.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await api.login(appNumber);
      navigate("/onboarding");
    } catch (err) {
      console.error(err);
      setError("Failed to validate application number. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-lg border-gray-100">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold tracking-tight text-center">
            Welcome to HR Automator
          </CardTitle>
          <CardDescription className="text-center">
            Enter your application number to continue your onboarding.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appNumber">Application Number</Label>
              <Input
                id="appNumber"
                placeholder="e.g. 12345"
                value={appNumber}
                onChange={(e) => setAppNumber(e.target.value)}
                disabled={loading}
              />
            </div>
            
            {error && (
              <div className="text-sm text-red-500 font-medium">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !appNumber.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Validating..." : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
