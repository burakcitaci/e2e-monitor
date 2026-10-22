import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';

export function ChatComposer({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (content: string) => void;
}) {
  const [content, setContent] = useState('');
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || !content.trim()) return;
        onSubmit(content);
        setContent('');
      }}
    >
      <Label htmlFor="chat-request">Your message</Label>
      <textarea
        id="chat-request"
        className="w-full rounded-md border bg-background p-3"
        rows={3}
        required
        maxLength={4000}
        disabled={disabled}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={
          'Prepare a draft for Azure topic application-events, or ask a messaging question'
        }
      />
      <Button type="submit" disabled={disabled || !content.trim()}>
        Ask assistant
      </Button>
    </form>
  );
}
