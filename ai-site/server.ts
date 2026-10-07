import { handleRequest } from "./api";

const server = Bun.serve({ port: Number(process.env.PORT) || 3000, fetch: handleRequest });
console.log(`Pagewright running at ${server.url}`);
