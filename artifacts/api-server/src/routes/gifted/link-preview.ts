import { Router } from "express";
import ogs from "open-graph-scraper";

const router = Router();

interface PreviewResult {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

const cache = new Map<string, PreviewResult>();

router.get("/gifted/link-preview", async (req, res) => {
  const { url } = req.query as { url?: string };

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url query param is required" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    res.status(400).json({ error: "Only http/https URLs are supported" });
    return;
  }

  if (cache.has(url)) {
    res.json(cache.get(url));
    return;
  }

  try {
    const { result } = await ogs({
      url,
      timeout: 5000,
      fetchOptions: {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; gifted-bot/1.0; +https://gifted.so)",
        },
      },
    });

    const preview: PreviewResult = {
      title: result.ogTitle ?? result.twitterTitle ?? null,
      description: result.ogDescription ?? result.twitterDescription ?? null,
      image: result.ogImage?.[0]?.url ?? result.twitterImage?.[0]?.url ?? null,
      siteName: result.ogSiteName ?? parsed.hostname.replace(/^www\./, "") ?? null,
    };

    cache.set(url, preview);
    res.json(preview);
  } catch {
    const fallback: PreviewResult = { title: null, description: null, image: null, siteName: null };
    res.json(fallback);
  }
});

export default router;
