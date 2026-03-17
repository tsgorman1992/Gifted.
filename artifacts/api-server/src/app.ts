import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import { passport, DrizzleSessionStore, SESSION_COOKIE, SESSION_TTL } from "./lib/auth";
import router from "./routes";

const app: Express = express();

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());

app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: SESSION_COOKIE,
    secret: process.env.SESSION_SECRET || "gifted-dev-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
    store: new DrizzleSessionStore(),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/api", router);

export default app;
