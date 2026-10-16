import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '../../../components/ui/sheet';
import { MessagingChatContent } from '..';
import { useConversation } from '../hooks/useConversation';

export default function MessagingChatSheet({
  open,
  onOpenChange,
  onReturnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReturnFocus: () => void;
}) {
  // Keep the conversation and prepared draft when the sheet is closed.
  const chat = useConversation();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-dvh w-full overflow-y-auto p-2 pt-8 sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <SheetTitle className="sr-only">Messaging assistant</SheetTitle>
        <SheetDescription className="sr-only">
          Prepare and review an Azure or AWS message without leaving the
          monitor.
        </SheetDescription>
        <MessagingChatContent chat={chat} />
      </SheetContent>
    </Sheet>
  );
}
