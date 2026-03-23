import { Router } from "express";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: Endpoints para verificar el estado del servidor
 *
 * /api/health:
 *   get:
 *     summary: Verifica el estado del servidor
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Servidor funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
router.get("/", (req, res) => {
  res.json({
    status: "ok"
  });
});

export default router;