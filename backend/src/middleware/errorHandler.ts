import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Bad Request",
      message: "Validation failed",
      details: err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  // 2. Custom API Errors or standard HTTP middleware errors
  const status = typeof err.statusCode === "number" ? err.statusCode : typeof err.status === "number" ? err.status : null;
  if (err instanceof ApiError || (status && status >= 400 && status < 600)) {
    const finalStatus = status || (err instanceof ApiError ? err.statusCode : 500);
    const isClientError = finalStatus < 500;
    res.status(finalStatus).json({
      error: isClientError ? (err.name || "Client Error") : "Internal Server Error",
      message: err.message || (isClientError ? "Invalid request" : "An error occurred"),
    });
    return;
  }

  // 3. Unhandled Server Exceptions
  console.error("[ServerError Unhandled Exception]:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred. Please try again later.",
  });
}

