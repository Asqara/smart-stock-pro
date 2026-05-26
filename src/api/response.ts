import { AppError } from "@/lib/errors";

/**
 * JSON response with optional Set-Cookie headers.
 */
export function jsonResponse(
  body: unknown,
  status = 200,
  cookies: string[] = [],
): Response {
  const response = Response.json(body, { status });

  for (const cookie of cookies) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}

/**
 * Safe API error response without stack traces.
 */
export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return jsonResponse(
      {
        code: error.code,
        message: error.publicMessage,
      },
      error.statusCode,
    );
  }

  return jsonResponse(
    {
      code: "INTERNAL_SERVER_ERROR",
      message: "Terjadi kesalahan pada server.",
    },
    500,
  );
}
