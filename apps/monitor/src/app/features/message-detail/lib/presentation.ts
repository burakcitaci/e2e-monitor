export const messageTimestamp = (value: Date | undefined | null) =>
  value ? value.toLocaleString() : 'Not reported';
