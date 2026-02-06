import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

const workAuthSchema = z.object({
  workCountry: z.string().min(2, "Required"),
  workCity: z.string().min(2, "Required"),
  rightToWork: z.literal(true, { errorMap: () => ({ message: "You must confirm your right to work." }) }),
  visaStatus: z.string().min(1, "Select a status"),
  sponsorship: z.string().min(1, "Select yes or no"), // handling as string from Select
  policyPrivacy: z.literal(true, { errorMap: () => ({ message: "Required" }) }),
  policyConduct: z.literal(true, { errorMap: () => ({ message: "Required" }) }),
});

export function StepWorkAuth({ data, onNext, onBack, isPaused }) {
  const { register, handleSubmit, setValue, watch, formState: { errors, ifSubmitting } } = useForm({
    resolver: zodResolver(workAuthSchema),
    defaultValues: data.steps.workAuth || {
      workCountry: "",
      workCity: "",
      rightToWork: false,
      visaStatus: "",
      sponsorship: "",
      policyPrivacy: false,
      policyConduct: false,
    }
  });

  const onSubmit = (formData) => {
    onNext("workAuth", formData, 5);
  };

  // Watchers for controlled components (Select, Checkbox)
  // Needed because shadcn components use their own state logic often unrelated to native inputs
  // We'll use simple native inputs/selects where possible or manual setValue for shadcn components.
  // shadcn Select doesn't register easily with raw react-hook-form 'register', need 'Controller' or manual setValue.
  // For speed/cleanliness in this artifact, I'll use standard hidden inputs + setValue for shadcn components 
  // or simply wrapping standard HTML elements styled nicely if possible, 
  // BUT user asked for shadcn components. So I need to wire them up.
  
  const handleSelectChange = (field, val) => setValue(field, val);
  const handleCheckChange = (field, val) => setValue(field, val);

  return (
    <Card className="shadow-md border-gray-100">
      <CardHeader>
        <CardTitle>Work Authorization</CardTitle>
        <CardDescription>Confirm your eligibility to work and acknowledge policies.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label>Work Location Country</Label>
              <Input {...register("workCountry")} disabled={isPaused} />
              {errors.workCountry && <p className="text-xs text-red-500">{errors.workCountry.message}</p>}
            </div>
             <div className="space-y-2">
              <Label>Work Location City</Label>
              <Input {...register("workCity")} disabled={isPaused} />
              {errors.workCity && <p className="text-xs text-red-500">{errors.workCity.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
             <Label>Current Visa Status</Label>
             <Select onValueChange={(v) => handleSelectChange('visaStatus', v)} defaultValue={data.steps.workAuth?.visaStatus} disabled={isPaused}>
               <SelectTrigger>
                 <SelectValue placeholder="Select status" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="citizen">Citizen</SelectItem>
                 <SelectItem value="permanent_resident">Permanent Resident</SelectItem>
                 <SelectItem value="work_visa">Work Visa</SelectItem>
                 <SelectItem value="student">Student</SelectItem>
                 <SelectItem value="other">Other</SelectItem>
               </SelectContent>
             </Select>
             {/* Hidden input for validation */}
             <input type="hidden" {...register("visaStatus")} />
             {errors.visaStatus && <p className="text-xs text-red-500">{errors.visaStatus.message}</p>}
          </div>

          <div className="space-y-2">
             <Label>Do you require sponsorship?</Label>
             <Select onValueChange={(v) => handleSelectChange('sponsorship', v)} defaultValue={data.steps.workAuth?.sponsorship} disabled={isPaused}>
               <SelectTrigger>
                 <SelectValue placeholder="Select..." />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="no">No</SelectItem>
                 <SelectItem value="yes">Yes</SelectItem>
               </SelectContent>
             </Select>
             <input type="hidden" {...register("sponsorship")} />
             {errors.sponsorship && <p className="text-xs text-red-500">{errors.sponsorship.message}</p>}
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-start space-x-2">
              <Checkbox 
                id="rightToWork" 
                onCheckedChange={(c) => handleCheckChange("rightToWork", c === true)} 
                defaultChecked={data.steps.workAuth?.rightToWork}
                disabled={isPaused}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="rightToWork" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I confirm I have the legal right to work in the specified location.
                </Label>
              </div>
            </div>
            {errors.rightToWork && <p className="text-xs text-red-500">{errors.rightToWork.message}</p>}

            <div className="flex items-start space-x-2">
              <Checkbox 
                id="policyPrivacy" 
                onCheckedChange={(c) => handleCheckChange("policyPrivacy", c === true)}
                defaultChecked={data.steps.workAuth?.policyPrivacy}
                disabled={isPaused}
              />
               <Label htmlFor="policyPrivacy" className="text-sm font-medium leading-none">
                  I acknowledge the Privacy Policy.
                </Label>
            </div>
            {errors.policyPrivacy && <p className="text-xs text-red-500">{errors.policyPrivacy.message}</p>}

             <div className="flex items-start space-x-2">
              <Checkbox 
                id="policyConduct" 
                onCheckedChange={(c) => handleCheckChange("policyConduct", c === true)}
                defaultChecked={data.steps.workAuth?.policyConduct}
                disabled={isPaused}
              />
               <Label htmlFor="policyConduct" className="text-sm font-medium leading-none">
                  I agree to the Code of Conduct.
                </Label>
            </div>
            {errors.policyConduct && <p className="text-xs text-red-500">{errors.policyConduct.message}</p>}
          </div>

        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" type="button" onClick={onBack}>Back</Button>
          <Button type="submit" disabled={ifSubmitting || isPaused}>
             Next
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
