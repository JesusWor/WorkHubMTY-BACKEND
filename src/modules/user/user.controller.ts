    import { UserService } from "./user.service";
    import { Request, Response } from "express";
    import { GlobalResponse } from "../../shared/response/globalresponse";
    import { z } from "zod";

    export type UserController = {
        getAll: (req: Request, res: Response) => Promise<void>;
        getById: (req: Request, res: Response) => Promise<void>;
        getAllByName: (req: Request, res: Response) => Promise<void>;
    }

    export function makeUserController(service: UserService): UserController {
        const getAll = async (req: Request, res: Response): Promise<void> => {
            try {
                const users = await service.getAll();
                GlobalResponse.okWithData(res, users);
            } catch (error) {
                GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
            }
        }

        const getById = async (req: Request, res: Response): Promise<void> => {
            try {
                if (!req.params.eId) {
                    GlobalResponse.badRequest(res, "User eId is required");
                    return;
                }

                const eId = z.string().min(1).parse(req.params.eId);

                const user = await service.getById(eId);
                if (!user) {
                    GlobalResponse.notFound(res, "User not found");
                    return;
                }

                GlobalResponse.okWithData(res, user);
            } catch (error) {
                GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
            }
        }

        const getAllByName = async (req: Request, res: Response): Promise<void> => {
            try {
                if (!req.params.name) {
                    GlobalResponse.badRequest(res, "User name is required");
                    return;
                }

                const name = z.string().min(1).parse(req.params.name);
                const users = await service.getAllByName(name);
                GlobalResponse.okWithData(res, users);
            } catch (error) {
                GlobalResponse.serverError(res, error instanceof Error ? error.message : undefined);
            }
        }

        return {
            getAll,
            getById,
            getAllByName
        }
    }