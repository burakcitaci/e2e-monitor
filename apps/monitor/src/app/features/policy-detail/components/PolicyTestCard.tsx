import { useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';
import type { Policy } from '../../../lib/schemas';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { PageSection } from '../../../components/common/Page';

function Command({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted p-2">
      <code className="min-w-0 flex-1 break-all text-xs">{value}</code>
      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => void copy()} aria-label="Copy command">
        {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}

export function PolicyTestCard({ policy }: { policy: Policy }) {
  const azure = policy.namespace.toLowerCase().includes('localhost') || policy.namespace.startsWith('sb://');
  const provider = azure ? 'azure' : 'aws';
  const subscribe = azure
    ? `dotnet run --project examples/servicebus-csharp -- subscribe --topic ${policy.destination} --subscription ${policy.subscription} --receiver ${policy.destinationService}`
    : `dotnet run --project examples/servicebus-csharp -- subscribe --provider aws --topic ${policy.destination} --queue ${policy.subscription} --receiver ${policy.destinationService}`;
  const publish = azure
    ? `dotnet run --project examples/servicebus-csharp -- publish --topic ${policy.destination} --sender ${policy.sourceService} --body "policy-test"`
    : `dotnet run --project examples/servicebus-csharp -- publish --provider aws --topic ${policy.destination} --sender ${policy.sourceService} --body "policy-test"`;
  return (
    <PageSection title="Test this policy" description="Start the subscriber first, then publish a test message. Captured events will appear in the chart and evidence table.">
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Terminal className="size-4" />{provider.toUpperCase()} test commands</CardTitle>
          <CardDescription>Expected delivery deadline: {policy.thresholdSeconds}s</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Command value={subscribe} />
          <Command value={publish} />
        </CardContent>
      </Card>
    </PageSection>
  );
}
