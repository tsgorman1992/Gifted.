import { Router, type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { passport, hashPassword, googleEnabled } from "../lib/auth";

const router = Router();

const ADMIN_EMAILS = new Set([
  "tsgorman1992@gmail.com",
  "brianreadnour2020@gmail.com",
]);

router.get("/auth/me", (req: Request, res: Response) => {
  if (req.isAuthenticated() && req.user) {
    const email = (req.user as any).email as string | null;
    const isAdmin = !!(email && ADMIN_EMAILS.has(email.toLowerCase()));
    res.json({ user: { ...req.user, isAdmin } });
  } else {
    res.json({ user: null });
  }
});

router.post("/auth/register", async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const normalized = email.toLowerCase().trim();
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, normalized)).limit(1);
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable)
    .values({ email: normalized, passwordHash, firstName: firstName?.trim() || null, lastName: lastName?.trim() || null })
    .returning();

  const safe = { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, profileImageUrl: user.profileImageUrl };

  req.login(safe, (err) => {
    if (err) { res.status(500).json({ error: "Login failed after registration." }); return; }
    res.json({ user: safe });
  });
});

router.post("/auth/login", (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate("local", (err: unknown, user: Express.User | false, info: { message?: string } | undefined) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || "Invalid email or password." });
    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      res.json({ user });
    });
  })(req, res, next);
});

router.post("/auth/logout", (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("gifted_sid");
      res.json({ success: true });
    });
  });
});

router.get("/auth/google/enabled", (_req: Request, res: Response) => {
  res.json({ enabled: googleEnabled });
});

router.patch("/auth/profile", async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { firstName, lastName, profileImageUrl } = req.body as {
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
  };

  try {
    const setFields: Record<string, unknown> = {};
    if (firstName !== undefined) setFields.firstName = firstName.trim() || null;
    if (lastName  !== undefined) setFields.lastName  = lastName.trim()  || null;
    if (profileImageUrl !== undefined) setFields.profileImageUrl = profileImageUrl || null;

    const [updated] = await db
      .update(usersTable)
      .set(setFields)
      .where(eq(usersTable.id, userId))
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        profileImageUrl: usersTable.profileImageUrl,
      });

    if (!updated) { res.status(404).json({ error: "User not found" }); return; }

    // Update the session with new data
    if (req.user) {
      (req.user as any).firstName = updated.firstName;
      (req.user as any).lastName = updated.lastName;
      (req.user as any).profileImageUrl = updated.profileImageUrl;
    }

    res.json({ user: updated });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

if (googleEnabled) {
  router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

  router.get("/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/sign-in?error=google" }),
    (_req: Request, res: Response) => {
      res.redirect("/my-gifts");
    },
  );
}

export default router;
