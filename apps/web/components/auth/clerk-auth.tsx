"use client";

import { SignIn, SignUp } from "@clerk/nextjs";

export function ClerkSignIn() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black px-4 py-12 sm:px-6">
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/challenges"
      />
    </div>
  );
}

export function ClerkSignUp() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black px-4 py-12 sm:px-6">
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/challenges"
      />
    </div>
  );
}
