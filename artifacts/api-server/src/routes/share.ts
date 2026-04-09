import { Router } from "express";
import { db, gifts } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

router.get("/share/:id", async (req, res) => {
  const { id } = req.params;

  let name = "you";
  let from = "someone special";

  try {
    const [gift] = await db.select().from(gifts).where(eq(gifts.id, id)).limit(1);
    if (gift) {
      name = gift.recipientName;
      from = gift.senderName;
    }
  } catch (err) {
    console.error("Error fetching gift for share page:", err);
  }

  name = esc(name);
  from = esc(from);

  const baseUrl   = process.env.GIFTED_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const ogImage   = `${baseUrl}/api/og/gift/${id}`;
  const ogTitle   = `A moment for ${name} ✨`;
  const ogDesc    = `${from} put something together just for you. Open your moment.`;
  const qs = Object.keys(req.query).length > 0
    ? "?" + new URLSearchParams(req.query as Record<string, string>).toString()
    : "";
  const redirectUrl = `/open/${id}${qs}`;
  const canonicalUrl = `${baseUrl}/share/${id}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${ogTitle}</title>
  <meta name="description" content="${ogDesc}" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDesc}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="gifted." />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDesc}" />
  <meta name="twitter:image" content="${ogImage}" />
</head>
<body style="background:#faf8f5;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:2rem;box-sizing:border-box;">
  <div style="text-align:center;">
    <p style="font-size:1.4rem;color:#2c1810;margin-bottom:1.2rem;">Opening your moment&hellip;</p>
    <a href="${redirectUrl}" style="color:#7a4a1e;font-size:0.95rem;text-decoration:underline;">Tap to open your moment</a>
  </div>
  <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
</body>
</html>`);
});

export default router;
