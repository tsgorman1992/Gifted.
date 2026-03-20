import { Router } from "express";
import ogs from "open-graph-scraper";
import dns from "dns/promises";
import net from "net";

const router = Router();

interface PreviewResult {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

const cache = new Map<string, PreviewResult>();

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 127) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  }
  if (net.isIPv6(ip)) {
    if (ip === "::1") return true;
    const lower = ip.toLowerCase();
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("fe80")) return true;
  }
  return false;
}

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

  try {
    const { address } = await dns.lookup(parsed.hostname);
    if (isPrivateIp(address)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  } catch {
    res.status(400).json({ error: "Could not resolve host" });
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
