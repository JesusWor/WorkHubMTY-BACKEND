import express, { Router } from "express";
import cors from "cors";
import { buildContainer } from "./app/container";

const app = express();

app.use(cors()); 
app.use(express.json());

const { roleRouter, userRouter, notificationRouter, authRouter } = buildContainer();

const router = Router();

router.use("/health", (req, res) => {
  res.json({
    status: "ok"
  })});

router.use("/users", userRouter.router);
router.use("notifications", notificationRouter);
router.use("/roles", roleRouter);
router.use("/auth/", authRouter)


app.use("/api", router);


export default app;
