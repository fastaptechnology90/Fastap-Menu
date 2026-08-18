import express, { type Express, type Request, type Response, type NextFunction } from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const PgSession = ConnectPgSimple(session);

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));

const BODY_LIMIT = process.env.BODY_LIMIT ?? "50mb";
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err && typeof err === "object" && "type" in err && err.type === "entity.too.large") {
    res.status(413).json({
      error: "Upload too large. Use smaller files (under 3 MB each) or fewer documents.",
    });
    return;
  }
  next(err);
});

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET ?? "fastapmenu-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.SECURE_COOKIE === "true",
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: "lax",
    },
  }),
);

app.use("/api", router);

// Serve the built website (fastap-admin) from this same service, so the API and the UI
// share one origin. That keeps the session cookie first-party (it is `sameSite: "lax"`),
// which is what a platform like Railway needs when there is no separate nginx in front.
// When the build is absent — local dev, where Vite serves the UI on its own port — this
// block is skipped and nothing changes.
const STATIC_DIR = process.env.STATIC_DIR ?? path.resolve(process.cwd(), "artifacts/fastap-admin/dist/public");
if (fs.existsSync(path.join(STATIC_DIR, "index.html"))) {
  app.use(express.static(STATIC_DIR));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      res.sendFile(path.join(STATIC_DIR, "index.html"));
      return;
    }
    next();
  });
}

/**
 * Last-resort error handler.
 *
 * Until now nothing caught errors that escaped a route, so they fell through to
 * Express's default handler: HTTP 500 with an HTML body. A sweep of every write
 * endpoint found 72 that answered 500 to an incomplete request — not because the
 * server was broken, but because bad input was never checked and the database was
 * the first thing to notice. The client got "Internal Server Error" where it should
 * have been told which field was missing.
 *
 * Two things are handled here:
 *
 *   1. Turn the failures the database already describes precisely into 4xx
 *      responses with the actual field name.
 *   2. Make sure nothing else ever returns an internal detail. Locally those
 *      500s carried full stack traces with absolute file paths; production hides
 *      them only because NODE_ENV happens to be set. That is protection by
 *      accident, not by design.
 *
 * Routes are untouched — this only catches what would otherwise have crashed.
 *
 * Drizzle wraps the driver error, so the pg fields live on `err.cause`, not on
 * `err` itself. Both are read here so a direct pg error is handled too.
 */
interface DbError {
  code?: string;
  column?: string;
  table?: string;
  constraint?: string;
  detail?: string;
}

function dbErrorOf(err: unknown): DbError {
  const e = err as { code?: string; cause?: DbError } & DbError;
  if (e?.cause?.code) return e.cause;
  if (e?.code) return e as DbError;
  return {};
}

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  // Something already started writing — let Express close the connection.
  if (res.headersSent) {
    next(err);
    return;
  }

  const e = err as { message?: string };
  const db = dbErrorOf(err);

  logger.error(
    {
      err,
      path: req.originalUrl,
      method: req.method,
      dbCode: db.code,
      dbColumn: db.column,
      dbTable: db.table,
      userId: req.session?.userId,
      staffId: req.session?.staffSession?.staffId,
    },
    "unhandled request error",
  );

  // Both keys are sent on purpose: the web client reads `error`, the Flutter
  // apps read `message` first and fall back to `error`.
  const fail = (status: number, message: string, code: string) => {
    res.status(status).json({ error: message, message, code });
  };

  // An update whose body contained no recognised fields. The ORM refuses an
  // empty SET rather than issuing a pointless query — that is a client mistake.
  if (e?.message === "No values to set") {
    fail(400, "No fields to update", "NO_FIELDS_TO_UPDATE");
    return;
  }

  switch (db.code) {
    case "23502": // not_null_violation — the database names the missing column
      fail(400, db.column ? `${db.column} is required` : "A required field is missing", "MISSING_FIELD");
      return;
    case "23505": // unique_violation
      fail(409, "That value is already in use", "DUPLICATE_VALUE");
      return;
    case "23503": // foreign_key_violation
      fail(400, "A referenced record does not exist", "INVALID_REFERENCE");
      return;
    case "22P02": // invalid_text_representation
    case "22007": // invalid_datetime_format
    case "22003": // numeric_value_out_of_range
      fail(400, "One of the values sent is not in the expected format", "INVALID_VALUE");
      return;
    default:
      break;
  }

  // Anything genuinely unexpected: log it above, tell the caller nothing.
  fail(500, "Something went wrong. Please try again.", "INTERNAL_ERROR");
});

export default app;
