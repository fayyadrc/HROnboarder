import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function StepWelcome({ data, onNext }) {
  const { candidateName } = data;

  const handleStart = () => {
    onNext("welcome", { seen: true }, 1);
  };

  return (
    <Card className="shadow-md border-gray-100 mt-10">
      <CardHeader className="text-center space-y-4 pb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
          <span className="text-2xl">👋</span>
        </div>
        <CardTitle className="text-3xl font-bold">Hi {candidateName}</CardTitle>
        <CardDescription className="text-lg">
          Let’s get started with your onboarding process.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center text-gray-500 max-w-md mx-auto">
        <p>
          We need a few details to finalize your offer and prepare for your first day.
          This will take approximately 5-10 minutes.
        </p>
      </CardContent>
      <CardFooter className="justify-center pt-6 pb-8">
        <Button size="lg" onClick={handleStart} className="w-full sm:w-auto px-8">
          Start Onboarding
        </Button>
      </CardFooter>
    </Card>
  );
}
