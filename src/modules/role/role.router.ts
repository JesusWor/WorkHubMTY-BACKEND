import { Router } from "express";
import { RoleController } from "./role.controller";
import { authMiddleware, roleMiddleware, Roles } from "../../middleware";


export type RoleRouter = {
    router: Router;
}

export function makeRoleRouter(controller: RoleController): RoleRouter {
    const router = Router();

    /**
     * @swagger
     * /api/roles:
     *   get:
     *     summary: Obtener todos los roles
     *     tags: [Roles]
     *     responses:
     *       200:
     *         description: Lista de roles
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Role'
     */
    router.get("/", authMiddleware, roleMiddleware(Roles.ADMIN), controller.getAll);

    /**
     * @swagger
     * /api/roles/{id}:
     *   get:
     *     summary: Obtener un rol por ID
     *     tags: [Roles]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: number
     *     responses:
     *       200:
     *         description: Rol encontrado
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Role'
     *       404:
     *         description: Rol no encontrado
     */
    router.get("/:id", authMiddleware, roleMiddleware(Roles.ADMIN), controller.getById);

    /**
     * @swagger
     * /api/roles:
     *   post:
     *     summary: Crear un rol
     *     tags: [Roles]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CreateRole'
     *     responses:
     *       201:
     *         description: Rol creado
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Role'
     */
    router.post("/", authMiddleware, roleMiddleware(Roles.ADMIN), controller.create);

    /**
     * @swagger
     * /api/roles/{id}:
     *   put:
     *     summary: Actualizar un rol
     *     tags: [Roles]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: number
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/UpdateRole'
     *     responses:
     *       200:
     *         description: Rol actualizado
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Role'
     */
    router.put("/:id", authMiddleware, roleMiddleware(Roles.ADMIN), controller.update);

    /**
     * @swagger
     * /api/roles/{id}:
     *   delete:
     *     summary: Eliminar un rol
     *     tags: [Roles]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: number
     *     responses:
     *       204:
     *         description: Rol eliminado
     */
    router.delete("/:id", authMiddleware, roleMiddleware(Roles.ADMIN), controller.delete);

    return { router }
}