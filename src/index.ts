import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/json", (c) => {
  return c.json({ message: "Hello Hono!" });
});

const PORT = (process.env.PORT || 3000) as number;
console.log("PORT: ", PORT);

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
