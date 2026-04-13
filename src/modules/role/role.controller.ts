import { RoleService } from "./role.service";
import { CreateRoleSchema, UpdateRoleSchema } from "./role.schema";
import { Request, Response } from "express";
import { GlobalResponse } from "../../shared/response/globalresponse";

export type RoleController = {
    getAll: (req: Request, res: Response) => Promise<void>;
    getById: (req: Request, res: Response) => Promise<void>;
    create: (req: Request, res: Response) => Promise<void>;
    update: (req: Request, res: Response) => Promise<void>;
    delete: (req: Request, res: Response) => Promise<void>;
}

export function makeRoleController(service: RoleService): RoleController {
    const getAll = async (_req: Request, res: Response): Promise<void> => {
        const roles = await service.getAll();
        GlobalResponse.okWithData(res, roles);
    };

    const getById = async (req: Request, res: Response): Promise<void> => {
        if (!req.params.id) {
            GlobalResponse.badRequest(res, "Role id is required");
            return;
        }

        const id = Number(req.params.id);
        if (isNaN(id)) {
            GlobalResponse.badRequest(res, "Invalid role id");
            return;
        }

        const role = await service.getById(id);
        if (!role) {
            GlobalResponse.notFound(res, "Role not found");
            return;
        }

        GlobalResponse.okWithData(res, role);
    };

    const create = async (req: Request, res: Response): Promise<void> => {
        const parsed = CreateRoleSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const created = await service.create(parsed.data);
        if (!created) {
            GlobalResponse.serverError(res, "Failed to create role");
            return;
        }

        GlobalResponse.created(res, created);
    };

    const update = async (req: Request, res: Response): Promise<void> => {
        if (!req.params.id) {
            GlobalResponse.badRequest(res, "Role id is required");
            return;
        }

        const id = Number(req.params.id);
        if (isNaN(id)) {
            GlobalResponse.badRequest(res, "Invalid role id");
            return;
        }

        const parsed = UpdateRoleSchema.safeParse(req.body);
        if (!parsed.success) {
            GlobalResponse.zodError(res, parsed.error);
            return;
        }

        const updated = await service.update(id, parsed.data);
        if (!updated) {
            GlobalResponse.notFound(res, "Role not found");
            return;
        }

        GlobalResponse.okWithData(res, updated);
    };

    const remove = async (req: Request, res: Response): Promise<void> => {
        if (!req.params.id) {
            GlobalResponse.badRequest(res, "Role id is required");
            return;
        }

        const id = Number(req.params.id);
        if (isNaN(id)) {
            GlobalResponse.badRequest(res, "Invalid role id");
            return;
        }

        const deleted = await service.delete(id);
        if (!deleted) {
            GlobalResponse.notFound(res, "Role not found");
            return;
        }

        GlobalResponse.okWithData(res, deleted);
    };

    return {
        getAll,
        getById,
        create,
        update,
        delete: remove
    };
}
