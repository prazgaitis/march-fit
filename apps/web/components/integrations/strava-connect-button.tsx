import Link from "next/link";
import { cn } from "@/lib/utils";

interface StravaConnectButtonProps {
  successUrl: string;
  errorUrl: string;
  className?: string;
}

export function StravaConnectButton({
  successUrl,
  errorUrl,
  className,
}: StravaConnectButtonProps) {
  const href = `/api/strava/connect?successUrl=${encodeURIComponent(successUrl)}&errorUrl=${encodeURIComponent(errorUrl)}`;

  return (
    <Link
      href={href}
      className={cn("inline-flex w-full items-center justify-center", className)}
      aria-label="Connect with Strava"
    >
      <img src="/strava-connect.svg" alt="Connect with Strava" className="h-11" />
    </Link>
  );
}
