import { Router, type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { passport, hashPassword, googleEnabled } from "../lib/auth";
import { verifyUnsubscribeToken } from "../lib/email";

const router = Router();

const ADMIN_EMAILS = new Set([
  "tsgorman1992@gmail.com",
  "brianreadnour2020@gmail.com",
]);

router.get("/auth/me", async (req: Request, res: Response) => {
  if (req.isAuthenticated() && req.user) {
    const email = (req.user as any).email as string | null;
    const isAdmin = !!(email && ADMIN_EMAILS.has(email.toLowerCase()));
    // Always fetch fresh from DB so phone and other new fields are included
    try {
      const userId = (req.user as any).id as string;
      const [fresh] = await db.select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        profileImageUrl: usersTable.profileImageUrl,
        phone: usersTable.phone,
        payoutMethod: usersTable.payoutMethod,
        payoutHandle: usersTable.payoutHandle,
        birthday: usersTable.birthday,
      }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      res.json({ user: fresh ? { ...fresh, isAdmin } : { ...req.user, isAdmin } });
    } catch {
      res.json({ user: { ...req.user, isAdmin } });
    }
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

  const { firstName, lastName, profileImageUrl, phone } = req.body as {
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
    phone?: string;
  };

  try {
    const setFields: Record<string, unknown> = {};
    if (firstName !== undefined) setFields.firstName = firstName.trim() || null;
    if (lastName  !== undefined) setFields.lastName  = lastName.trim()  || null;
    if (profileImageUrl !== undefined) setFields.profileImageUrl = profileImageUrl || null;
    if (phone !== undefined) {
      const cleaned = phone.replace(/\D/g, "");
      setFields.phone = cleaned.length >= 10 ? phone.trim() : null;
    }

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
        phone: usersTable.phone,
      });

    if (!updated) { res.status(404).json({ error: "User not found" }); return; }

    // Update the session with new data
    if (req.user) {
      (req.user as any).firstName = updated.firstName;
      (req.user as any).lastName = updated.lastName;
      (req.user as any).profileImageUrl = updated.profileImageUrl;
      (req.user as any).phone = updated.phone;
    }

    res.json({ user: updated });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.get("/auth/unsubscribe", async (req: Request, res: Response) => {
  const uid   = req.query.uid   as string | undefined;
  const token = req.query.token as string | undefined;

  const fail = (msg: string) => {
    res.status(400).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>gifted.</title></head>
<body style="font-family:-apple-system,sans-serif;text-align:center;padding:80px 24px;background:#faf8f5;color:#1a1310;">
<p style="font-size:28px;font-weight:500;color:#7c4a1e;font-family:Georgia,serif;margin:0 0 24px;">gifted.</p>
<h1 style="font-size:20px;margin:0 0 12px;">${msg}</h1>
<p style="color:#6b6059;">If you need help, email us at <a href="mailto:help@gifted.page" style="color:#7c4a1e;">help@gifted.page</a>.</p>
</body></html>`);
  };

  if (!uid || !token) { fail("Invalid unsubscribe link."); return; }

  if (!verifyUnsubscribeToken(uid, token)) { fail("This unsubscribe link is invalid or has expired."); return; }

  try {
    await db.update(usersTable)
      .set({ unsubscribedMarketing: true })
      .where(eq(usersTable.id, uid));

    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Unsubscribed — gifted.</title></head>
<body style="font-family:-apple-system,sans-serif;text-align:center;padding:80px 24px;background:#faf8f5;color:#1a1310;">
<p style="font-size:28px;font-weight:500;color:#7c4a1e;font-family:Georgia,serif;margin:0 0 24px;">gifted.</p>
<h1 style="font-size:22px;margin:0 0 12px;">You've been unsubscribed.</h1>
<p style="color:#6b6059;max-width:400px;margin:0 auto 24px;">You won't receive any more marketing emails from gifted. Transactional messages (like gift receipts and redemption confirmations) are not affected.</p>
<a href="https://gifted.page" style="display:inline-block;background:#7c4a1e;color:#fff;text-decoration:none;padding:12px 28px;border-radius:100px;font-size:14px;font-weight:600;">Back to gifted.</a>
</body></html>`);
  } catch (err) {
    console.error("[unsubscribe] Failed to update user:", err);
    fail("Something went wrong. Please try again or contact us.");
  }
});

if (googleEnabled) {
  router.get("/auth/google", (req: Request, res: Response, next: NextFunction) => {
    const raw = (req.query.returnTo as string) || "";
    // Only allow relative paths to prevent open redirect attacks
    const returnTo = raw.startsWith("/") ? raw : "/my-gifts";
    (req.session as any).returnTo = returnTo;
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });

  router.get("/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/sign-in?error=google" }),
    (req: Request, res: Response) => {
      const returnTo = (req.session as any).returnTo || "/my-gifts";
      delete (req.session as any).returnTo;
      res.redirect(returnTo);
    },
  );
}

export default router;
