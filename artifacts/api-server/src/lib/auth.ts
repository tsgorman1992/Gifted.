import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcryptjs";
import expressSession from "express-session";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const SESSION_COOKIE = "gifted_sid";
export const SESSION_TTL    = 7 * 24 * 60 * 60 * 1000;

export type SafeUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
};

function toSafe(u: typeof usersTable.$inferSelect): SafeUser {
  return { id: u.id, email: u.email ?? null, firstName: u.firstName ?? null, lastName: u.lastName ?? null, profileImageUrl: u.profileImageUrl ?? null };
}

declare global {
  namespace Express {
    interface User extends SafeUser {}
  }
}

passport.serializeUser((user, done) => done(null, (user as SafeUser).id));

passport.deserializeUser(async (id: string, done) => {
  try {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    done(null, u ? toSafe(u) : false);
  } catch (err) { done(err, false); }
});

passport.use("local", new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
  try {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (!u || !u.passwordHash) return done(null, false, { message: "Invalid email or password." });
    const valid = await bcrypt.compare(password, u.passwordHash);
    if (!valid) return done(null, false, { message: "Invalid email or password." });
    return done(null, toSafe(u));
  } catch (err) { return done(err); }
}));

const googleClientId     = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (googleClientId && googleClientSecret) {
  passport.use("google", new GoogleStrategy(
    {
      clientID:     googleClientId,
      clientSecret: googleClientSecret,
      callbackURL:  "/api/auth/google/callback",
      scope: ["profile", "email"],
    },
    async (_at, _rt, profile, done) => {
      try {
        const email     = profile.emails?.[0]?.value?.toLowerCase() ?? null;
        const firstName = profile.name?.givenName ?? null;
        const lastName  = profile.name?.familyName ?? null;
        const photo     = profile.photos?.[0]?.value ?? null;

        let [u] = await db.select().from(usersTable).where(eq(usersTable.googleId, profile.id)).limit(1);
        if (!u && email) {
          [u] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
        }
        if (u) {
          const [updated] = await db.update(usersTable)
            .set({ googleId: profile.id, profileImageUrl: photo ?? u.profileImageUrl, updatedAt: new Date() })
            .where(eq(usersTable.id, u.id)).returning();
          return done(null, toSafe(updated));
        }
        const [created] = await db.insert(usersTable)
          .values({ email, firstName, lastName, profileImageUrl: photo, googleId: profile.id })
          .returning();
        return done(null, toSafe(created));
      } catch (err) { return done(err as Error); }
    },
  ));
}

export { passport };
export const googleEnabled = !!(googleClientId && googleClientSecret);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export class DrizzleSessionStore extends expressSession.Store {
  async get(sid: string, cb: (err: unknown, session?: Express.SessionData | null) => void) {
    try {
      const [row] = await db.select().from(sessionsTable).where(eq(sessionsTable.sid, sid)).limit(1);
      if (!row || row.expire < new Date()) {
        if (row) await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
        return cb(null, null);
      }
      cb(null, row.sess as unknown as Express.SessionData);
    } catch (err) { cb(err); }
  }

  async set(sid: string, session: Express.SessionData, cb?: (err?: unknown) => void) {
    try {
      const expire = session.cookie?.expires ? new Date(session.cookie.expires) : new Date(Date.now() + SESSION_TTL);
      await db.insert(sessionsTable)
        .values({ sid, sess: session as unknown as Record<string, unknown>, expire })
        .onConflictDoUpdate({ target: sessionsTable.sid, set: { sess: session as unknown as Record<string, unknown>, expire } });
      cb?.();
    } catch (err) { cb?.(err); }
  }

  async destroy(sid: string, cb?: (err?: unknown) => void) {
    try {
      await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
      cb?.();
    } catch (err) { cb?.(err); }
  }
}
