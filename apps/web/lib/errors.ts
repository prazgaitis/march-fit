import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: { error: error.message },
    };
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: "Validation error",
        details: error.issues,
      },
    };
  }

  console.error(error);
  return {
    status: 500,
    body: { error: "Internal server error" },
  };
}
