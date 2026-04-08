import app from "./app";
import { startScheduler } from "./scheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (!process.env.GIFTED_BASE_URL) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "GIFTED_BASE_URL is required in production. Set it to the canonical public URL (e.g. https://gifted.page) so OG share image URLs are reachable by link preview crawlers."
    );
  }
  console.warn("WARNING: GIFTED_BASE_URL is not set. OG share image URLs will use the request host, which may be incorrect in production.");
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  if (process.env.GIFTED_BASE_URL) {
    console.log(`Share base URL: ${process.env.GIFTED_BASE_URL}`);
  }
  const twilioNum = process.env.TWILIO_PHONE_NUMBER;
  console.log(`[config] TWILIO_PHONE_NUMBER=${twilioNum ? twilioNum.slice(0, 6) + "****" + twilioNum.slice(-2) : "NOT SET"}`);
  startScheduler();
});
