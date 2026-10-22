export function MessageActions({
  message,
}: {
  message: { trackingSource?: 'capture' };
}) {
  return (
    <span
      className="text-xs text-muted-foreground"
      title="The collector displays reported activity and does not settle broker messages."
    >
      {message.trackingSource === 'capture' ? 'Application report' : 'History'}
    </span>
  );
}
