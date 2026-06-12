# WorkHubMTY — Backend

API REST y WebSocket server para la plataforma WorkHubMTY de gestión de espacios de trabajo.

---

## Tecnologías

| Tecnología            | Uso                                                   |
|-----------------------|-------------------------------------------------------|
| Node.js + Express     | Servidor HTTP                                         |
| TypeScript            | Tipado estático                                       |
| MySQL 8 (mysql2)      | Base de datos principal                               |
| Redis + BullMQ        | Colas de trabajos (no-show y checkout automático)     |
| Socket.IO             | Notificaciones en tiempo real                         |
| Zod                   | Validación de requests                                |
| JWT (HTTP-only cookie)| Autenticación stateless                               |
| Resend                | Envío de correos transaccionales                      |
| Google Gemini         | Asistente IA con herramientas (tool use)              |
| Vitest                | Testing unitario e integración                        |

---

## Estructura del proyecto

```
src/
├── app/
│   ├── container.ts        ← Wiring manual de repos → services → controllers → routers
│   └── testContainer.ts    ← Versión para tests con fakeAuthenticate
├── config/                 ← Variables de entorno y configuración global
├── infra/
│   ├── db/                 ← Pool de conexiones MySQL (mysql2)
│   ├── mail/               ← Servicio de correo (Resend)
│   ├── redis/              ← Cliente Redis
│   ├── queue/              ← Colas BullMQ y workers (office-queue, parking-queue)
│   ├── events/             ← EventEmitters tipados por dominio
│   ├── websocket/          ← Servidor Socket.IO + broadcasters por dominio
│   └── gemini/             ← Cliente Google Generative AI
├── middleware/
│   ├── authentication.middleware.ts  ← Valida JWT desde cookie HTTP-only
│   ├── authorization.middleware.ts   ← Control de roles por endpoint
│   └── errorHandler.middleware.ts    ← Captura AppError y formatea respuesta
├── modules/                ← Módulos de negocio (ver abajo)
└── shared/
    ├── errors/             ← AppError y subclases (BadRequest, NotFound, etc.)
    ├── response/           ← Formato estándar de respuestas API
    ├── schemas/            ← Schemas Zod compartidos (auth, paginación)
    ├── types/              ← Tipos globales y extensión de Express Request
    └── utils/              ← JWT, logger, GUID, utilidades de roles
```

---

## Módulos

Cada módulo sigue la misma estructura de capas:

```
module/
├── controller.ts   ← Maneja HTTP request/response, llama al service
├── service.ts      ← Lógica de negocio, reglas, máquinas de estado
├── repo.ts         ← Queries SQL directas con mysql2
├── router.ts       ← Endpoints + middlewares de auth/authz
├── schema.ts       ← Schemas Zod: validación de DTOs y tipos de dominio
└── index.ts        ← Re-exportaciones públicas del módulo
```

### Módulos implementados

| Módulo           | Descripción                                                                 |
|------------------|-----------------------------------------------------------------------------|
| `auth`           | Login, registro, refresh tokens, logout                                     |
| `user`           | Perfil, búsqueda, gestión de invitados, amigos, timeline                    |
| `role`           | Roles del sistema: ADMIN, IT, USER, STAFF, GUEST                            |
| `friendship`     | Solicitudes de amistad, aceptar / rechazar / cancelar                       |
| `teams`          | Crear y gestionar equipos de trabajo                                        |
| `office-slots`   | Espacios reservables (cubículos/salas) y reservaciones con participantes    |
| `parking-slots`  | Cajones de estacionamiento y reservaciones                                  |
| `guest-events`   | Eventos para invitados externos con notificación por correo                 |
| `notifications`  | Notificaciones del sistema entregadas vía Socket.IO                         |
| `chat`           | Asistente IA (Gemini) con herramientas para buscar y reservar espacios      |
| `achievements`   | Logros y gamificación por uso del sistema                                   |
| `reports`        | Reportes de uso y ocupación de espacios                                     |

---

## Funcionalidades clave

### Reservaciones de espacios (office-slots)

Módulo central del sistema. Gestiona espacios reservables (cubículos, salas de reuniones):

- **CRUD de espacios** con nombre, código, piso, capacidad y tipo
- **Disponibilidad en tiempo real**: filtra por rango de tiempo, piso, capacidad y texto libre
- **Reservaciones con participantes**: el creador puede invitar a compañeros; cada uno puede aceptar o rechazar
- **Máquina de estados**:
  ```
  PENDING → ACTIVE (check-in)
          → NO_SHOW (automático si no hay check-in en 30 min)
          → CANCELED
  ACTIVE  → CHECKED_OUT
  ```
- **Check-in por código QR o manual**; checkout manual o automático al llegar el endTime
- **Cola BullMQ**: programa automáticamente los jobs de no-show y checkout al crear la reserva
- **WebSocket**: emite eventos a los participantes al crear, actualizar o cancelar reservas

### Reservaciones de estacionamiento (parking-slots)

- Reserva de cajones por periodo (startTime / endTime)
- Proyección de disponibilidad sin guardar bloques intermedios
- Gestión de asistencia: `PENDING → CHECKED_IN → CHECKED_OUT / NO_SHOW / CANCELED`

### Amistades y red social (friendship + user)

- Enviar, aceptar, rechazar y cancelar solicitudes de amistad
- Ver lista de amigos con perfil completo
- Buscar posibles amigos (`/users/me/potential-friends`)
- Ver la **agenda (timeline)** de cualquier usuario: sus reservas activas y próximas (`/users/:eId/timeline`)

### Asistente IA — Chat (chat)

El módulo `chat` expone `POST /chat` conectado a Google Gemini con un sistema de **tool use**. El modelo puede invocar herramientas registradas en el `ToolRegistry`:

| Herramienta               | Tipo     | Descripción                                                         |
|---------------------------|----------|---------------------------------------------------------------------|
| `getAvailableReservables` | SERVER   | Busca espacios disponibles con fallback automático de filtros       |
| `createReservation`       | SERVER   | Crea una reserva en nombre del usuario autenticado                  |
| `getParkingAvailability`  | SERVER   | Consulta disponibilidad de estacionamiento                          |
| `showSpaceCarousel`       | CLIENT   | Ordena al frontend mostrar un carrusel de espacios sugeridos        |
| `getUserProfile`          | CLIENT   | Ordena al frontend navegar al perfil de un compañero                |

El `ResourceRegistry` provee contexto al modelo (datos del usuario actual, hora actual, empresa, etc.).

### Equipos (teams)

- Crear equipos y gestionar membresía
- Un equipo puede ser asociado a una reserva de espacio
- Consultar mis equipos y los miembros de cada uno

### Eventos para invitados (guest-events)

- Supervisores crean eventos para personas externas
- Envío de invitación por correo (Resend) al registrar un invitado
- Re-envío individual de invitación a un participante específico

---

## Flujo mínimo de reserva de espacio

```
1. Usuario autenticado (JWT en cookie HTTP-only)
         ↓
2. GET /office-slots/slots/available?startTime=...&endTime=...
   → Devuelve espacios sin conflicto en el rango solicitado
         ↓
3. POST /office-slots/slots/:slotId/reservations
   Body: { startTime, endTime, participants: [userId, ...] }
   → Service valida solapamiento y permisos
   → Crea reserva con estado PENDING
   → Encola job BullMQ de no-show  (startTime + 30 min)
   → Encola job BullMQ de checkout (endTime)
   → Emite evento WebSocket a todos los participantes
         ↓
4. POST /office-slots/reservations/:id/checkin  (QR o manual)
   → Estado cambia a ACTIVE
   → Cancela el job de no-show
         ↓
5. POST /office-slots/reservations/:id/checkout
   → Estado cambia a CHECKED_OUT
   → Cancela el job de checkout automático
```

Si el usuario no hace check-in dentro del período de tolerancia (30 min), BullMQ marca la reserva como `NO_SHOW` automáticamente.

---

## Roles del sistema

| Rol     | Descripción                                                   |
|---------|---------------------------------------------------------------|
| `ADMIN` | Acceso total                                                  |
| `IT`    | Administración técnica, visibilidad total                     |
| `USER`  | Empleado estándar: reservar, ver compañeros, usar chatbot     |
| `STAFF` | Personal de piso: registrar check-in/checkout                 |
| `GUEST` | Invitado externo: acceso muy limitado                         |

---

## Flujo en tiempo real

```
Service emite domain event (EventEmitter)
    ↓
Broadcaster en infra/websocket/broadcasters/ escucha el evento
    ↓
Broadcaster llama io.emit / io.to(room).emit
    ↓
Cliente recibe actualización por WebSocket
```

---

## Instalación y ejecución local

```bash
npm install

# Desarrollo (requiere MySQL y Redis — ver compose.yml en el directorio raíz)
npm run dev

# Producción
npm run build
npm start

# Tests
npm test              # todos
npm run test:unit     # solo unitarios
npm run test:integration  # requiere .env.test con DB disponible
```

### Variables de entorno

Crea un archivo `.env`:

```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=
DB_USER_PASSWORD=
DB_NAME=

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=
ACCESS_TOKEN_EXPIRES_MS=900000
REFRESH_TOKEN_EXPIRES_MS=604800000

RESEND_API_KEY=
RESEND_FROM_ADDRESS=

GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
```

Para tests de integración crea `.env.test` con los mismos campos apuntando a una base de datos de prueba.

---

## Arquitectura general

```
HTTP Request
    ↓
Router → authenticate → authorize → Controller
    ↓
Service (lógica de negocio + máquinas de estado)
    ↓
Repository (queries MySQL con mysql2)
    ↓
Efectos secundarios:
  ├── BullMQ  → jobs de no-show / checkout automático
  ├── Socket.IO → notificaciones en tiempo real
  └── Resend  → correos transaccionales
```
