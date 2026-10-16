import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../../components/ui/dialog';
import { MessagingChatContent } from '..';
import { useConversation } from '../hooks/useConversation';

export default function MessagingChatPopup({
  open,
  onOpenChange,
  onReturnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReturnFocus: () => void;
}) {
  // Keep the conversation and prepared draft when the popup is closed.
  const chat = useConversation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[50%] max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl translate-y-[-50%] overflow-y-auto p-2 pt-8"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <DialogTitle className="sr-only">Messaging assistant</DialogTitle>
        <DialogDescription className="sr-only">
          Prepare and review an Azure or AWS message without leaving the
          monitor.
        </DialogDescription>
        <MessagingChatContent chat={chat} />
      </DialogContent>
    </Dialog>
  );
}
