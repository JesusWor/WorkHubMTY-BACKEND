import { Router } from "express";
import { UserController } from "./user.controller.js";

export function makeUserRouter(controller: UserController): Router {
  const router = Router();

  /**
   * @swagger
   * /api/users/login:
   *   post:
   *     summary: Login de usuario
   *     tags: [Users]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - e_id
   *               - password
   *             properties:
   *               e_id:
   *                 type: string
   *                 example: "EMP001"
   *               password:
   *                 type: string
   *                 example: "secret123"
   *     responses:
   *       200:
   *         description: Login exitoso
   *       401:
   *         description: Credenciales inválidas
   *       422:
   *         description: Error de validación
   */
  router.post("/login", controller.login);

  return router;
}