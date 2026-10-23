import React from 'react';
import { Button } from '../../components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet';

export type PolicyForm = {
  name: string;
  namespace: string;
  sourceService: string;
  destinationService: string;
  destination: string;
  subscription: string;
  thresholdSeconds: string;
  requiredSuccessPercentage: string;
  evaluationWindowMinutes: string;
  minimumSampleCount: string;
};
export function CreatePolicySheet({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: PolicyForm;
  setForm: React.Dispatch<React.SetStateAction<PolicyForm>>;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const textFields = [
    ['name', 'Policy name'],
    ['namespace', 'Namespace'],
    ['sourceService', 'Publisher service'],
    ['destinationService', 'Subscriber service'],
    ['destination', 'Topic or queue'],
    ['subscription', 'Subscription'],
  ] as const;
  const numberFields = [
    ['thresholdSeconds', 'Delivery deadline (seconds)', '0.001'],
    ['requiredSuccessPercentage', 'Required success (%)', '0'],
    ['evaluationWindowMinutes', 'Evaluation window (minutes)', '1'],
    ['minimumSampleCount', 'Minimum sample count', '1'],
  ] as const;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create policy</SheetTitle>
          <SheetDescription>
            A matching publish creates an obligation for this subscriber to
            receive the message before the deadline.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {textFields.map(([field, label]) => (
            <label key={field} className="block text-sm font-medium">
              {label}
              <input
                required
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 font-normal"
              />
            </label>
          ))}
          {numberFields.map(([field, label, min]) => (
            <label key={field} className="block text-sm font-medium">
              {label}
              <input
                required
                type="number"
                min={min}
                max={field === 'requiredSuccessPercentage' ? '100' : undefined}
                step={field === 'thresholdSeconds' ? '0.1' : '1'}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 font-normal"
              />
            </label>
          ))}
          <Button type="submit" className="w-full">
            Create policy
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
