export const seed = {
    roles: [
        { id: 1, name: 'Admin' },
        { id: 2, name: 'Usuario' },
    ],
    users: [
        {
            eId: 'USR00001',
            name: 'Ana Test',
            email: 'ana@test.com',
            password: 'password123', // plain — hashed on insert
            roleId: 1,
        },
        {
            eId: 'USR00002',
            name: 'Luis Test',
            email: 'luis@test.com',
            password: 'otherpass',
            roleId: 2,
        },
    ],
    parking_lots: [
        { id: 1, name: 'Lote Pequeño', capacity: 50 },
        { id: 2, name: 'Lote Grande', capacity: 200 },
    ],
    parking_reservations: [] as Array<{
        id: number;
        parking_lot_id: number;
        user_id: string;
        start_time: string;
        end_time: string;
        checked_in: number;
    }>,
} as const;

export type SeedTable = keyof typeof seed;

// Insertion order matters for FK constraints
export const TABLE_ORDER: SeedTable[] = [
    'roles', 'users',
    'parking_lots', 'parking_reservations',
];
