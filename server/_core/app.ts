import express, { type Express } from "express";
import type { Server } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

export async function createApp(server?: Server): Promise<Express> {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  if (process.env.NODE_ENV === "development") {
    if (!server) {
      throw new Error("HTTP server instance is required in development mode");
    }
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  return app;
}
