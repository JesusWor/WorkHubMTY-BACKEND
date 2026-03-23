import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/swagger";
import express from "express";
import cors from "cors";
import router from "./routes";
import notificationRoutes from "./app/routes/notification.routes";

const app = express();

app.use(cors()); 
app.use(express.json());
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api", router);

app.get("/health", (req, res) => {
  res.send("API OK");
});

app.use("/Notification", notificationRoutes);

export default app;
