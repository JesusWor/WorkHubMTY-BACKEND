import { RoleService } from "./role.service";
import { RoleSchema, CreateRoleSchema, UpdateRoleSchema } from "./role.schema";
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
    const getAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const roles = await service.getAll();
            GlobalResponse.okWithData(res, roles);
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    }

    const getById = async (req: Request, res: Response): Promise<void> => {
        try {
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
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    }

    const create = async (req: Request, res: Response): Promise<void> => {
        try {
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
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    }

    const update = async (req: Request, res: Response): Promise<void> => {
        try {
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
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    }

    const remove = async (req: Request, res: Response): Promise<void> => {
        try {
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
        } catch (error) {
            GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
        }
    }

    return {
        getAll,
        getById,
        create,
        update,
        delete: remove
    }
}