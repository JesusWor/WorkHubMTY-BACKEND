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
    achievement_icons: [
        { id: 1, name: 'users' },
        { id: 2, name: 'network' },
        { id: 3, name: 'flame' },
    ],
    achievements: [
        { id: 1, name: 'Ya llegué al trabajo', iconId: 1 },
        { id: 2, name: 'Cancelé a tiempo', iconId: 2 },
        { id: 3, name: 'No show controlado', iconId: 3 },
        { id: 4, name: 'Red de aliados', iconId: 2 },
    ],
    achievement_levels: [
        { achievementId: 1, level: 1, progressRequired: 1, description: 'Registrar llegada al estacionamiento' },
        { achievementId: 2, level: 1, progressRequired: 1, description: 'Cancelar una reserva' },
        { achievementId: 3, level: 1, progressRequired: 1, description: 'Registrar un no-show' },
        { achievementId: 4, level: 1, progressRequired: 1, description: 'Hacer una nueva amistad' },
    ],
    user_achievements: [] as Array<{
        userId: string;
        achievementId: number;
        progress: number;
    }>,
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
    'achievement_icons', 'achievements', 'achievement_levels', 'user_achievements',
    'parking_lots', 'parking_reservations',
];
