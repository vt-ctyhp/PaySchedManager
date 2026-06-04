import bcrypt from "bcryptjs";
import { type User } from "@shared/schema";
import { storage } from "./storage";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function authenticateUser(username: string, password: string): Promise<User | null> {
  const user = await storage.getUserByUsername(username);
  if (!user) return null;
  
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) return null;
  
  return user;
}

export function requireAuth(req: any, res: any, next: any) {
  if (req.session?.userId) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
}

export function requireAdmin(req: any, res: any, next: any) {
  if (req.session?.userId && req.session?.userRole === "Admin") {
    next();
  } else {
    res.status(403).json({ message: "Forbidden - Admin access required" });
  }
}

export async function getCurrentUser(userId: string): Promise<User | null> {
  const user = await storage.getUser(userId);
  if (!user) return null;
  
  return {
    ...user,
    password: "", // Never send password to client
  };
}
