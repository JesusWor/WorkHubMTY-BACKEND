import { Router } from "express";
import healthRouter from "./health.router";
import generateTokenRouter from "./generate-token.router";
import { buildContainer } from "../app/container";

const router = Router();

const { roleRouter } = buildContainer();

router.use("/health", healthRouter);
router.use("/generate-token", generateTokenRouter)

router.use("/roles", roleRouter.router);

export default router;