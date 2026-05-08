import { Router, type IRouter } from "express";
import {
  DatabaseHealthCheckResponse,
  HealthCheckResponse,
} from "@workspace/api-zod";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/db/healthz", async (_req, res, next) => {
  try {
    await db.execute(sql`select 1`);
    const data = DatabaseHealthCheckResponse.parse({
      status: "ok",
      database: "connected",
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
