import { Router } from "express";
import healthRouter from "./health.router";
import generateTokenRouter from "./generate-token.router";
import { buildContainer } from "../app/container";

const router = Router();

const { roleRouter, userRouter } = buildContainer();

router.use("/health", healthRouter);
router.use("/generate-token", generateTokenRouter)

router.use("/roles", roleRouter.router);
router.use("/users", userRouter.router);

export default router;