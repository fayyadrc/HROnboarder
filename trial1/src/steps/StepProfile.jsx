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

const profileSchema = z.object({
  maritalStatus: z.string().optional(),
  dependents: z.string().optional(), // treating number input as string often easier
  homeAddressConfirm: z.boolean().optional(),
  
  ecName: z.string().min(2, "Name is required"),
  ecRelationship: z.string().min(2, "Relationship is required"),
  ecPhone: z.string().min(5, "Phone is required"),
});

export function StepProfile({ data, onNext, onBack, isPaused }) {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: data.steps.profile || {
      maritalStatus: "",
      dependents: "",
      homeAddressConfirm: false,
      ecName: "",
      ecRelationship: "",
      ecPhone: ""
    }
  });

  const onSubmit = (formData) => {
    onNext("profile", formData, 6);
  };

  const handleSelectChange = (field, val) => setValue(field, val);
  const handleCheckChange = (field, val) => setValue(field, val);

  return (
    <Card className="shadow-md border-gray-100">
      <CardHeader>
        <CardTitle>Personal & HR Profile</CardTitle>
        <CardDescription>Final details for your HR file.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          
          {/* Optional Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-6">
            <div className="space-y-2">
               <Label>Marital Status (Optional)</Label>
               <Select onValueChange={(v) => handleSelectChange('maritalStatus', v)} defaultValue={data.steps.profile?.maritalStatus} disabled={isPaused}>
                 <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="single">Single</SelectItem>
                   <SelectItem value="married">Married</SelectItem>
                   <SelectItem value="prefer_not_say">Prefer not to say</SelectItem>
                 </SelectContent>
               </Select>
            </div>

            <div className="space-y-2">
               <Label>Number of Dependents (Optional)</Label>
               <Input type="number" {...register("dependents")} disabled={isPaused} />
            </div>

            <div className="md:col-span-2 flex items-center space-x-2 pt-2">
                 <Checkbox 
                id="homeAddressConfirm" 
                onCheckedChange={(c) => handleCheckChange("homeAddressConfirm", c === true)}
                defaultChecked={data.steps.profile?.homeAddressConfirm}
                disabled={isPaused}
              />
               <Label htmlFor="homeAddressConfirm" className="text-sm font-medium">
                  Confirm home address is same as mailing address? (Optional)
               </Label>
            </div>
          </div>

          {/* Required Emergency Contact */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Emergency Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input {...register("ecName")} disabled={isPaused} />
                  {errors.ecName && <p className="text-xs text-red-500">{errors.ecName.message}</p>}
                </div>
                 <div className="space-y-2">
                  <Label>Relationship</Label>
                  <Input {...register("ecRelationship")} placeholder="e.g. Spouse, Parent" disabled={isPaused} />
                   {errors.ecRelationship && <p className="text-xs text-red-500">{errors.ecRelationship.message}</p>}
                </div>
                 <div className="space-y-2 md:col-span-2">
                  <Label>Phone Number</Label>
                  <Input type="tel" {...register("ecPhone")} disabled={isPaused} />
                   {errors.ecPhone && <p className="text-xs text-red-500">{errors.ecPhone.message}</p>}
                </div>
            </div>
          </div>

        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" type="button" onClick={onBack}>Back</Button>
          <Button type="submit" disabled={isPaused}>Next</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
