import { OfficeSlotsRepo } from "./office-slots.repo";
import { OfficeSlot, CreateOfficeSlotBody, UpdateOfficeSlotBody, BlockSlotBody, AvailableOfficeSlotsQuery, SlotAvailabilityResult, FriendOccupancy } from "./office-slots.schema";
import { NotFoundError, UnprocessableError } from "../../shared/errors/AppError";

export type OfficeSlotsService = {
  getAvailableSlots: (query: AvailableOfficeSlotsQuery) => Promise<SlotAvailabilityResult[]>;
  getAllSlots: (filters: { floor_id?: number }) => Promise<any[]>;
  getSlotById: (id: number) => Promise<OfficeSlot>;
  createSlot: (data: CreateOfficeSlotBody) => Promise<OfficeSlot>;
  updateSlot: (id: number, data: UpdateOfficeSlotBody) => Promise<OfficeSlot>;
  deleteSlot: (id: number) => Promise<{ message: string }>;
  setBlockStatus: (id: number, body: BlockSlotBody) => Promise<OfficeSlot>;
};

export function makeOfficeSlotsService(repo: OfficeSlotsRepo): OfficeSlotsService {
    const getAvailableSlots = async (query: AvailableOfficeSlotsQuery): Promise<SlotAvailabilityResult[]> => {
        const { start_time, end_time, user_id, floor_id } = query;

        const rows = await repo.findAvailable(start_time, end_time, { floor_id });
        let friendShipMap: Record<number, FriendOccupancy[]> = {};
        
        if (user_id) {
            const slotIds = rows.map((r) => r.id as number);
            const occupancy = await repo.findFriendOccupancy(slotIds, user_id, start_time, end_time);
            for (const occ of occupancy) {
                const sid = (occ as any).slot_id as number;
                if (!friendShipMap[sid]) {
                    friendShipMap[sid] = [];
                }
                friendShipMap[sid].push(occ);
            }
        }

        return rows.map((r) => ({
            id: r.id,
            name: r.name,
            capacity: r.capacity,
            floor_id: r.floor_id,
            floor_name: r.floor_name,
            is_blocked: Boolean(r.is_blocked),
            is_available: Boolean(r.is_available),
            occupied_by_friends: friendShipMap[r.id] ?? [],
        }));
    };

    const getAllSlots = async (filters: { floor_id?: number }): Promise<any[]> => {
        return repo.findAll(filters);
    };

    const getSlotById = async (id: number): Promise<OfficeSlot> => {
        const slot = await repo.findById(id);
        if (!slot) throw new NotFoundError(`Slot ${id} no encontrado`);
        return slot;
    };
    
    const createSlot = async (data: CreateOfficeSlotBody): Promise<OfficeSlot> => {
        const floorOk = await repo.floorExists(data.floor_id);
        if (!floorOk) throw new UnprocessableError(`El piso ${data.floor_id} no existe`);
        const id = await repo.create(data);
        return (await repo.findById(id))!;
    };

    const updateSlot = async (id: number, data: UpdateOfficeSlotBody): Promise<OfficeSlot> => {
        await getSlotById(id);
        if (data.floor_id !== undefined) {
        const floorOk = await repo.floorExists(data.floor_id);
        if (!floorOk) throw new UnprocessableError(`El piso ${data.floor_id} no existe`);
        }
        await repo.update(id, data);
        return (await repo.findById(id))!;
    };
    
    const deleteSlot = async (id: number): Promise<{ message: string }> => {
        await getSlotById(id);
        await repo.remove(id);
        return { message: `Slot ${id} eliminado` };
    };
    
    const setBlockStatus = async (id: number, body: BlockSlotBody): Promise<OfficeSlot> => {
        await getSlotById(id);
        await repo.setBlocked(id, body.is_blocked);
        return (await repo.findById(id))!;
    };

    return {
        getAvailableSlots,
        getAllSlots,
        getSlotById,
        createSlot,
        updateSlot,
        deleteSlot,
        setBlockStatus,
    };
}