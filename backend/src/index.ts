import app from "./app.js";

const DEFAULT_PORT = 3000;
const parsedPort = Number.parseInt(process.env.PORT ?? "", 10);
const PORT = Number.isNaN(parsedPort) ? DEFAULT_PORT : parsedPort;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`server running on 0.0.0.0:${PORT}`);
});
