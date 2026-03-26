import express, { Router } from "express";
import cors from "cors";
import { buildContainer } from "./app/container";

import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/swagger";

const app = express();

app.use(cors()); 
app.use(express.json());
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const { roleRouter, userRouter, notificationRouter, authRouter } = buildContainer();

const router = Router();

router.use("/health", (req, res) => {
  res.json({
    status: "ok"
  })});

router.use("/user", userRouter);
router.use("notifications", notificationRouter);
router.use("/roles", roleRouter);
router.use("/auth/", authRouter)


app.use("/api", router);


export default app;
