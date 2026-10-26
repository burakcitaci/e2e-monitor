import React from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../components/ui/sheet';

import type { PolicyForm } from '../lib/policy-form';
export function CreatePolicySheet({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  pending,
  editing = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: PolicyForm;
  setForm: React.Dispatch<React.SetStateAction<PolicyForm>>;
  onSubmit: (event: React.FormEvent) => void;
  pending: boolean;
  editing?: boolean;
}) {
  const textFields = [
    ['name', 'Policy name'],
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
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{editing ? 'Edit policy' : 'Create policy'}</SheetTitle>
          <SheetDescription>
            A matching publish creates an obligation for this subscriber to
            receive the message before the deadline.
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={onSubmit}
          className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2"
        >
          <label className="block min-w-0 text-sm font-medium">
            Provider
            <select
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value as 'azure' | 'aws' })}
              className="mt-1 h-10 w-full rounded border bg-background px-3 py-2 font-normal"
            >
              <option value="azure">Azure Service Bus</option>
              <option value="aws">AWS</option>
            </select>
          </label>
          {textFields.map(([field, label]) => (
            <label key={field} className="block min-w-0 text-sm font-medium">
              {label}
              <Input
                required
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 font-normal"
              />
            </label>
          ))}
          {numberFields.map(([field, label, min]) => (
            <label key={field} className="block min-w-0 text-sm font-medium">
              {label}
              <Input
                required
                type="number"
                min={min}
                max={field === 'requiredSuccessPercentage' ? '100' : undefined}
                step={field === 'thresholdSeconds' ? 'any' : '1'}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 font-normal"
              />
            </label>
          ))}
          <Button
            type="submit"
            disabled={pending}
            className="col-span-full mt-1 w-full"
          >
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Create policy'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
