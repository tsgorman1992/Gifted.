import { Router } from "express";
import { db, gifts } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const OG_IMAGES: Record<string, string> = {
  "confetti-burst": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=630&fit=crop",
  "golden-hour":    "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=630&fit=crop",
  "garden-bloom":   "https://images.unsplash.com/photo-1490750967868-88df5691cc7e?w=1200&h=630&fit=crop",
  "midnight-stars": "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1200&h=630&fit=crop",
  "rose-petal":     "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=1200&h=630&fit=crop",
  "snow-flurry":    "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1200&h=630&fit=crop",
  "sunrise":        "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200&h=630&fit=crop",
};

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
  let exp = "confetti-burst";

  try {
    const [gift] = await db.select().from(gifts).where(eq(gifts.id, id)).limit(1);
    if (gift) {
      name = gift.recipientName;
      from = gift.senderName;
      exp = gift.experience;
    }
  } catch (err) {
    console.error("Error fetching gift for share page:", err);
  }

  name = esc(name);
  from = esc(from);

  const ogImage       = OG_IMAGES[exp] ?? OG_IMAGES["confetti-burst"];
  const ogTitle       = `A gift for ${name} 🎁`;
  const ogDescription = `${from} sent you something special on gifted. Tap to open your gift.`;

  const redirectUrl = `/open/${id}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${ogTitle}</title>
  <meta name="description" content="${ogDescription}" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="gifted." />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDescription}" />
  <meta name="twitter:image" content="${ogImage}" />
  <meta http-equiv="refresh" content="0;url=${redirectUrl}" />
</head>
<body style="background:#faf8f5;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:2rem;box-sizing:border-box;">
  <div style="text-align:center;">
    <p style="font-size:1.4rem;color:#2c1810;margin-bottom:1.2rem;">Opening your gift&hellip;</p>
    <a href="${redirectUrl}" style="color:#7a4a1e;font-size:0.95rem;text-decoration:underline;">Tap here if you are not redirected</a>
  </div>
  <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
</body>
</html>`);
});

export default router;
