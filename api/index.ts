import express, { type Request, type Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "../server/routes";
import { storage } from "../server/storage";

// Single Express app reused across warm invocations of this serverless function.
// The Vite client is served by Vercel as static assets (dist/public); this
// function only handles the /api/* surface (routed here via vercel.json).
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set("trust proxy", 1);

const PgSession = connectPgSimple(session);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: new PgSession({
      conObject: {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        // Keep per-instance connections low; many lambdas share the DB pooler.
        max: 3,
      },
      // The `session` table is provisioned via migration; do not rely on
      // connect-pg-simple reading its bundled table.sql at runtime (that file
      // is not included in the esbuild bundle).
      createTableIfMissing: false,
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    },
  }),
);

// Initialise storage + register routes once per cold start. On failure we reset
// the promise so the next invocation retries instead of serving a dead app.
let initPromise: Promise<void> | null = null;
function init(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await storage.initialize();
      await registerRoutes(app);
      app.use(
        (err: any, _req: Request, res: Response, _next: (e?: any) => void) => {
          const status = err.status || err.statusCode || 500;
          res.status(status).json({ message: err.message || "Internal Server Error" });
        },
      );
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export default async function handler(req: Request, res: Response) {
  await init();
  return (app as unknown as (req: Request, res: Response) => void)(req, res);
}
