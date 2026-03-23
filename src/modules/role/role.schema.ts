import { z } from "zod";

/**
 * @swagger
 * components:
 *   schemas:
 *     Role:
 *       type: object
 *       required:
 *         - id
 *         - name
 *       properties:
 *         id:
 *           type: number
 *           example: 1
 *         name:
 *           type: string
 *           example: Admin
 *
 *     CreateRole:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           example: Admin
 *
 *     UpdateRole:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: Admin actualizado
 */

export const RoleSchema = z.object({
    id: z.number(),
    name: z.string()
});
export type Role = z.infer<typeof RoleSchema>;

export const CreateRoleSchema = RoleSchema.omit({ id: true });
export type CreateRole = z.infer<typeof CreateRoleSchema>;

export const UpdateRoleSchema = RoleSchema.partial().pick({ name: true });
export type UpdateRole = z.infer<typeof UpdateRoleSchema>;