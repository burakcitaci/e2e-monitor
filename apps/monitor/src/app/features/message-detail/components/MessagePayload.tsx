import { PageSection } from '../../../components/common/Page';
import { Badge } from '../../../components/ui/badge';

export function MessagePayload({ body }: { body?: string }) {
  let text = body ?? 'Payload not reported';
  let format = 'Plain text';
  try {
    text = JSON.stringify(JSON.parse(text), null, 2);
    format = 'JSON';
  } catch {
    // Plain text bodies are valid.
  }
  return (
    <PageSection
      title="Payload"
      actions={<Badge variant="outline">{format}</Badge>}
    >
      <pre className="max-h-[32rem] overflow-auto rounded-lg bg-muted/50 p-4 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {text}
      </pre>
    </PageSection>
  );
}
