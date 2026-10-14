import { createApp } from "./app.js";
import { getConfig } from "./config/env.js";
import { connectDatabase } from "./dao/index.js";

const config = getConfig();
const { client, daos } = await connectDatabase(config);
const app = createApp({ daos, config });
const server = app.listen(config.port, config.host, () => console.log(`API listening on ${config.host}:${config.port}`));

async function shutdown(signal) {
  console.log(`${signal} received; closing server`);
  server.close(async () => { await client.close(); process.exit(0); });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
