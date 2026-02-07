import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

// Schema for validation
const identitySchema = z.object({
  fullName: z.string().min(2, "Legal full name is required"),
  preferredName: z.string().optional(),
  dob: z.string().min(1, "Date of birth is required"),
  nationality: z.string().min(2, "Nationality is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(5, "Phone number is required"),
  address: z.string().min(5, "Current residential address is required"),
  country: z.string().min(2, "Country of residence is required"),
});

export function StepIdentity({ data, onNext, onBack, isPaused }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(identitySchema),
    defaultValues: data.steps.identity || {
      fullName: data.candidateName || "", // Pre-fill if available
      preferredName: "",
      dob: "",
      nationality: "",
      email: "",
      phone: "",
      address: "",
      country: ""
    }
  });

  const onSubmit = (formData) => {
    onNext(
      "identity",
      {
        ...formData,
        candidateEmail: formData.email,
        personalEmail: formData.email,
      },
      3
    );
  };

  return (
    <Card className="shadow-md border-gray-100">
      <CardHeader>
        <CardTitle>Identity & Contact</CardTitle>
        <CardDescription>Please provide your legal identity and contact information.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Legal Full Name</Label>
              <Input id="fullName" {...register("fullName")} disabled={isPaused} />
              {errors.fullName && <p className="text-xs text-red-500">{errors.fullName.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="preferredName">Preferred Name (Optional)</Label>
              <Input id="preferredName" {...register("preferredName")} disabled={isPaused} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input type="date" id="dob" {...register("dob")} disabled={isPaused} />
              {errors.dob && <p className="text-xs text-red-500">{errors.dob.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality / Citizenships</Label>
              <Input id="nationality" placeholder="e.g. American, Canadian" {...register("nationality")} disabled={isPaused} />
              {errors.nationality && <p className="text-xs text-red-500">{errors.nationality.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label htmlFor="email">Personal Email</Label>
              <Input type="email" id="email" {...register("email")} disabled={isPaused} />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input type="tel" id="phone" {...register("phone")} disabled={isPaused} />
              {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
            </div>
          </div>

           <div className="space-y-2">
              <Label htmlFor="address">Current Residential Address</Label>
              <Input id="address" {...register("address")} disabled={isPaused} />
              {errors.address && <p className="text-xs text-red-500">{errors.address.message}</p>}
            </div>

             <div className="space-y-2">
              <Label htmlFor="country">Country of Residence</Label>
              <Input id="country" {...register("country")} disabled={isPaused} />
              {errors.country && <p className="text-xs text-red-500">{errors.country.message}</p>}
            </div>

        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onBack}>Back</Button>
          <Button type="submit" disabled={isSubmitting || isPaused}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Next
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
