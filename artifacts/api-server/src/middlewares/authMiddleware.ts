import { type Request, type Response, type NextFunction } from "express";
import type { SafeUser } from "../lib/auth";

declare global {
  namespace Express {
    interface User extends SafeUser {}
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  next();
}
