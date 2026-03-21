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
  console.warn("WARNING: GIFTED_BASE_URL is not set. OG share image URLs will use the request host, which may be incorrect in production.");
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  if (process.env.GIFTED_BASE_URL) {
    console.log(`Share base URL: ${process.env.GIFTED_BASE_URL}`);
  }
  startScheduler();
});
