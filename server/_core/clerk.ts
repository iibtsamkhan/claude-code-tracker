import { verifyToken, createClerkClient } from "@clerk/backend";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const CLERK_SESSION_COOKIE = "__session";

const clerkClient = createClerkClient({
  secretKey: ENV.clerkSecretKey || undefined,
});

function getAuthToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  if (!req.headers.cookie) return null;
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[CLERK_SESSION_COOKIE] ?? null;
}

function getNameFromClerkUser(clerkUser: any): string | null {
  const fullName = [clerkUser.firstName, clerkUser.lastName]
    .filter((value: unknown) => typeof value === "string" && value.length > 0)
    .join(" ")
    .trim();
  if (fullName) return fullName;
  if (typeof clerkUser.username === "string" && clerkUser.username.length > 0) {
    return clerkUser.username;
  }
  return null;
}

function getEmailFromClerkUser(clerkUser: any): string | null {
  if (typeof clerkUser.primaryEmailAddress?.emailAddress === "string") {
    return clerkUser.primaryEmailAddress.emailAddress;
  }
  if (Array.isArray(clerkUser.emailAddresses) && clerkUser.emailAddresses.length > 0) {
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    return typeof email === "string" ? email : null;
  }
  return null;
}

export async function authenticateClerkRequest(req: Request): Promise<User> {
  if (!ENV.clerkSecretKey) {
    throw ForbiddenError("CLERK_SECRET_KEY is not configured");
  }

  const token = getAuthToken(req);
  if (!token) {
    throw ForbiddenError("Missing Clerk session token");
  }

  let payload: Record<string, unknown>;
  try {
    payload = await verifyToken(token, {
      secretKey: ENV.clerkSecretKey,
    });
  } catch (error) {
    throw ForbiddenError("Invalid Clerk token");
  }

  const clerkUserId = typeof payload.sub === "string" ? payload.sub : null;
  if (!clerkUserId) {
    throw ForbiddenError("Invalid Clerk token payload");
  }

  const signedInAt = new Date();
  let user = await db.getUserByOpenId(clerkUserId);

  if (!user) {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    await db.upsertUser({
      openId: clerkUserId,
      name: getNameFromClerkUser(clerkUser),
      email: getEmailFromClerkUser(clerkUser),
      loginMethod: "clerk",
      lastSignedIn: signedInAt,
    });
    user = await db.getUserByOpenId(clerkUserId);
  }

  if (!user) {
    throw ForbiddenError("User sync failed");
  }

  await db.upsertUser({
    openId: user.openId,
    lastSignedIn: signedInAt,
  });

  return user;
}
