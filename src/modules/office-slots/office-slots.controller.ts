import { Request, Response } from "express";
import { OfficeSlotsService } from "./office-slots.service";
import { GlobalResponse } from "../../shared/response/globalresponse";
import { CreateOfficeSlotSchema, UpdateOfficeSlotSchema, BlockSlotBodySchema, AvailableOfficeSlotsSchema, SlotIdParamSchema } from "./office-slots.schema";

export type OfficeSlotsController = {
    getAll: (req: Request, res: Response) => Promise<void>;
    getAvailable: (req: Request, res: Response) => Promise<void>;
    getById: (req: Request, res: Response) => Promise<void>;
    create: (req: Request, res: Response) => Promise<void>;
    update: (req: Request, res: Response) => Promise<void>;
    remove: (req: Request, res: Response) => Promise<void>;
    setBlock: (req: Request, res: Response) => Promise<void>;
}

export function makeOfficeSlotsController(service: OfficeSlotsService): OfficeSlotsController {
    const getAll = async (req: Request, res: Response): Promise<void> => {
        const floor_id = req.query.floor_id ? Number(req.query.floor_id) : undefined;
        const slots = await service.getAllSlots({ floor_id });
        GlobalResponse.okWithData(res, slots);
    };
    
    const getAvailable = async (req: Request, res: Response): Promise<void> => {
        const query = AvailableOfficeSlotsSchema.parse(req.query);
        const slots = await service.getAvailableSlots(query);
        GlobalResponse.okWithData(res, slots);
    };
    
    const getById = async (req: Request, res: Response): Promise<void> => {
        const { id } = SlotIdParamSchema.parse(req.params);
        const slot = await service.getSlotById(id);
        GlobalResponse.okWithData(res, slot);
    };
    
    const create = async (req: Request, res: Response): Promise<void> => {
        const body = CreateOfficeSlotSchema.parse(req.body);
        const slot = await service.createSlot(body);
        GlobalResponse.created(res, slot);
    };
    
    const update = async (req: Request, res: Response): Promise<void> => {
        const { id } = SlotIdParamSchema.parse(req.params);
        const body = UpdateOfficeSlotSchema.parse(req.body);
        const slot = await service.updateSlot(id, body);
        GlobalResponse.okWithData(res, slot);
    };
    
    const remove = async (req: Request, res: Response): Promise<void> => {
        const { id } = SlotIdParamSchema.parse(req.params);
        const result = await service.deleteSlot(id);
        GlobalResponse.ok(res, result.message);
    };
    
    const setBlock = async (req: Request, res: Response): Promise<void> => {
        const { id } = SlotIdParamSchema.parse(req.params);
        const body = BlockSlotBodySchema.parse(req.body);
        const slot = await service.setBlockStatus(id, body);
        GlobalResponse.okWithData(res, slot);
    };
    
    return { 
        getAll, 
        getAvailable, 
        getById, 
        create, 
        update, 
        remove, 
        setBlock 
    };
}