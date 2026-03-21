import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller";

const router = Router();
const controller = new NotificationController();

router.post("/subscribe", controller.subscribe);

router.post("/send", controller.send);

router.get("/user/:userId", controller.getUserNotifications);

router.patch("/read/:id", controller.markAsRead);

router.delete("/:id", controller.delete);

export default router;