export function generateUsername({
  email,
  fallbackId,
}: {
  email?: string | null;
  fallbackId: string;
}) {
  if (email) {
    const [localPart] = email.split("@");
    if (localPart) {
      return localPart.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 30) || fallbackId;
    }
  }

  return `user_${fallbackId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
}
