import { Router } from "express";
import { generateToken } from "../shared/utils/jwt.util";
import { JwtPayload, Roles } from "../shared/schemas/auth.schema";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Endpoints de autenticación y generación de tokens
 *
 * /api/generate-token:
 *   get:
 *     summary: Genera un token JWT temporal con rol Admin hardcodeado
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Token generado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 payload:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       example: "1"
 *                     email:
 *                       type: string
 *                       example: example@mail.com
 *                     role:
 *                       type: string
 *                       example: Admin
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */
router.get("/", (req, res) => {
    const payload: JwtPayload = {
        userId: "1",
        email: "example@mail.com",
        role: Roles.ADMIN
    }

    const token = generateToken(payload);

    res.json({
        status: "ok",
        token: token
    });
});

export default router;