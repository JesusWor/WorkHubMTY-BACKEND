# WorkHubMTY Backend

## Descripción General

WorkHubMTY Backend es una API REST desarrollada con TypeScript y Express enfocada en la administración de usuarios, autenticación, reservaciones, espacios de oficina, estacionamientos, notificaciones y funcionalidades colaborativas en tiempo real.

La arquitectura está diseñada siguiendo principios modulares y separación de responsabilidades para facilitar:

- Escalabilidad.
- Mantenibilidad.
- Reutilización.
- Integración con frontend.
- Desarrollo colaborativo.
- Organización por módulos.
- Manejo centralizado de errores.
- Comunicación en tiempo real.

---

# Tecnologías Utilizadas

## Backend

- Node.js
- Express
- TypeScript
- PostgreSQL
- Socket.IO
- JWT Authentication
- Nodemailer
- Zod
- Docker

---

# Instalación del Proyecto

## Clonar repositorio

```bash
git clone <repository-url>
```

---

## Entrar al proyecto

```bash
cd WorkHubMTY-BACKEND
```

---

## Instalar dependencias

```bash
npm install
```

---

# Dependencias Principales

```bash
npm install express cors mysql2 zod pg dotenv socket.io nodemailer jsonwebtoken uuid swagger-ui-express
```

---

# Dependencias de Desarrollo

```bash
npm install -D typescript ts-node-dev @types/node
```

---

# Tipos TypeScript Necesarios

```bash
npm install -D @types/pg
npm install -D @types/socket.io
npm install -D @types/nodemailer
npm install -D @types/jsonwebtoken
npm install -D @types/bcrypt
```

---

# Variables de Entorno

Crear un archivo:

```bash
.env
```

Ejemplo:

```env
PORT=4000

DATABASE_URL=postgresql://postgres:password@localhost:5432/workhub

JWT_SECRET=super_secret_key

SMTP_EMAIL=test@email.com
SMTP_PASSWORD=password
```

---

# Ejecutar Proyecto

## Desarrollo

```bash
npm run dev
```

---

## Producción

```bash
npm run build
npm run start
```

---

# Estructura del Proyecto

```bash
src/
 ├── app/
 ├── config/
 ├── infra/
 ├── middleware/
 ├── modules/
 ├── shared/
 ├── app.ts
 └── server.ts
```

---

# Organización de Carpetas

## app/

Configuración principal de la aplicación y contenedor de dependencias.

```bash
app/
 └── container.ts
```

Responsabilidades:

- Inicialización de servicios.
- Inyección de dependencias.
- Configuración principal.
- Registro de módulos.

---

## config/

Configuraciones globales del sistema.

Responsabilidades:

- Variables de entorno.
- Configuración global.
- Configuración de producción/desarrollo.
- Parámetros del servidor.

---

## infra/

Infraestructura externa del sistema.

```bash
infra/
 ├── db/
 ├── mail/
 └── websocket/
```

Responsabilidades:

- Conexión con base de datos.
- Servicios de email.
- Comunicación en tiempo real.
- Integraciones externas.

---

### infra/db/

```bash
db/
 └── db.ts
```

Responsable de:

- Conexión PostgreSQL.
- Pools de conexiones.
- Queries globales.
- Inicialización de base de datos.

---

### infra/mail/

```bash
mail/
 ├── email.service.ts
 └── email.types.ts
```

Responsable de:

- Envío de correos.
- Templates de email.
- Tipado de emails.
- Notificaciones automáticas.

---

### infra/websocket/

```bash
websocket/
 ├── socket.server.ts
 └── socket.types.ts
```

Responsable de:

- Eventos Socket.IO.
- Comunicación en tiempo real.
- Manejo de conexiones.
- Notificaciones en vivo.

---

## middleware/

Middlewares globales del sistema.

```bash
middleware/
 ├── authentication.middleware.ts
 ├── authorization.middleware.ts
 ├── errorHandler.middleware.ts
 └── index.ts
```

Responsabilidades:

- Validación JWT.
- Autorización por roles.
- Manejo global de errores.
- Protección de rutas.
- Centralización de middlewares.

---

### authentication.middleware.ts

Responsable de:

- Validar tokens JWT.
- Verificar usuarios autenticados.
- Adjuntar usuario al request.

---

### authorization.middleware.ts

Responsable de:

- Validar permisos.
- Control de roles.
- Restricción de acceso.

---

### errorHandler.middleware.ts

Responsable de:

- Capturar errores globales.
- Respuestas estandarizadas.
- Logging de errores.

---

## modules/

Módulos principales del sistema.

```bash
modules/
 ├── auth/
 ├── user/
 ├── role/
 ├── friendship/
 ├── notifications/
 ├── office-slots/
 ├── parking-slots/
 └── achievements/
```

Cada módulo sigue una arquitectura basada en capas.

---

# Arquitectura de Módulos

Cada módulo utiliza la siguiente estructura:

```bash
module/
 ├── controller.ts
 ├── service.ts
 ├── repo.ts
 ├── router.ts
 ├── schema.ts
 └── index.ts
```

---

## Explicación de Capas

### Controller

Responsable de:

- Manejar requests HTTP.
- Manejar responses.
- Llamar servicios.
- Controlar flujo HTTP.

---

### Service

Responsable de:

- Lógica de negocio.
- Reglas del sistema.
- Procesamiento principal.
- Validaciones complejas.

---

### Repository

Responsable de:

- Queries SQL.
- Acceso a base de datos.
- Persistencia.
- Manejo de entidades.

---

### Router

Responsable de:

- Definición de endpoints.
- Registro de rutas.
- Asociación de middlewares.

---

### Schema

Responsable de:

- Validaciones con Zod.
- Validación de DTOs.
- Validación de requests.

---

# Módulos Implementados

---

## auth/

Sistema de autenticación.

```bash
auth/
 ├── auth.controller.ts
 ├── auth.repo.ts
 ├── auth.router.ts
 ├── auth.schema.ts
 ├── auth.service.ts
 └── index.ts
```

Responsabilidades:

- Login.
- Registro.
- JWT.
- Validación de usuarios.
- Seguridad.

---

## user/

Gestión de usuarios.

```bash
user/
 ├── user.controller.ts
 ├── user.repo.ts
 ├── user.router.ts
 ├── user.schema.ts
 ├── user.service.ts
 └── index.ts
```

Responsabilidades:

- CRUD usuarios.
- Información de perfil.
- Gestión de cuentas.

---

## role/

Sistema de roles y permisos.

```bash
role/
 ├── role.controller.ts
 ├── role.repo.ts
 ├── role.router.ts
 ├── role.schema.ts
 ├── role.service.ts
 └── index.ts
```

Responsabilidades:

- Roles del sistema.
- Permisos.
- Control de acceso.

---

## friendship/

Sistema social y conexiones.

```bash
friendship/
 ├── friendship.controller.ts
 ├── friendship.repo.ts
 ├── friendship.router.ts
 ├── friendship.schema.ts
 ├── friendship.service.ts
 └── index.ts
```

Responsabilidades:

- Solicitudes de amistad.
- Conexiones entre usuarios.
- Relaciones colaborativas.

---

## notifications/

Sistema de notificaciones.

```bash
notifications/
 ├── notifications.controller.ts
 ├── notifications.routes.ts
 ├── notifications.schema.ts
 ├── notifications.service.ts
 └── index.ts
```

Responsabilidades:

- Notificaciones del sistema.
- Eventos en tiempo real.
- Alertas.

---

## office-slots/

Reservaciones de oficina.

```bash
office-slots/
 ├── office-slots.controller.ts
 ├── office-slots.repo.ts
 ├── office-slots.router.ts
 ├── office-slots.schema.ts
 ├── office-slots.service.ts
 └── index.ts
```

Responsabilidades:

- Reservación de espacios.
- Gestión de horarios.
- Disponibilidad.
- Conflictos.

---

## parking-slots/

Reservaciones de estacionamiento.

```bash
parking-slots/
 ├── parking-slots.controller.ts
 ├── parking-slots.repo.ts
 ├── parking-slots.routes.ts
 ├── parking-slots.schema.ts
 ├── parking-slots.service.ts
 └── index.ts
```

Responsabilidades:

- Gestión de estacionamientos.
- Reservaciones.
- Disponibilidad.

---

## achievements/

Sistema de logros.

```bash
achievements/
 ├── achievements.controller.ts
 ├── achievements.repo.ts
 ├── achievements.router.ts
 ├── achievements.schema.ts
 ├── achievements.service.ts
 └── index.ts
```

Responsabilidades:

- Logros de usuario.
- Gamificación.
- Recompensas.

---

## shared/

Código reutilizable global.

```bash
shared/
 ├── errors/
 ├── response/
 ├── schemas/
 ├── types/
 └── utils/
```

---

### shared/errors/

```bash
errors/
 └── AppError.ts
```

Responsable de:

- Errores personalizados.
- Manejo uniforme de excepciones.
- Estandarización de errores.

---

### shared/response/

```bash
response/
 └── globalresponse.ts
```

Responsable de:

- Responses globales.
- Formato estándar API.
- Consistencia de respuestas.

---

### shared/schemas/

```bash
schemas/
 └── auth.schema.ts
```

Responsable de:

- Schemas reutilizables.
- Validaciones compartidas.

---

### shared/types/

```bash
types/
 ├── express.d.ts
 └── role.type.ts
```

Responsable de:

- Tipos globales.
- Extensión de Express Request.
- Tipado del sistema.

---

### shared/utils/

```bash
utils/
 ├── guid.util.ts
 ├── jwt.util.ts
 ├── logger.util.ts
 └── role.util.ts
```

---

#### guid.util.ts

Responsable de:

- Generación de GUIDs.
- IDs únicos.

---

#### jwt.util.ts

Responsable de:

- Generación JWT.
- Validación JWT.
- Manejo de tokens.

---

#### logger.util.ts

Responsable de:

- Logging del sistema.
- Debugging.
- Seguimiento de errores.

---

#### role.util.ts

Responsable de:

- Utilidades de roles.
- Verificación de permisos.

---

# app.ts

Configuración principal de Express.

Responsabilidades:

- Configuración middleware.
- Registro de rutas.
- Inicialización de Express.
- Configuración global.

---

# server.ts

Punto de entrada principal.

Responsabilidades:

- Inicialización del servidor.
- Configuración de puertos.
- Startup del sistema.

---

# Arquitectura General

La aplicación utiliza una arquitectura modular basada en capas.

```text
Routes
   ↓
Middlewares
   ↓
Controllers
   ↓
Services
   ↓
Repositories
   ↓
Database
```

---

# Flujo General del Sistema

```text
Request HTTP
   ↓
Router
   ↓
Middleware
   ↓
Controller
   ↓
Service
   ↓
Repository
   ↓
PostgreSQL
```

---

# Flujo de Autenticación

```text
Login Request
   ↓
Validation Schema
   ↓
Controller
   ↓
Service
   ↓
JWT Generation
   ↓
Response Token
```

---

# Comunicación en Tiempo Real

El backend implementa Socket.IO para:

- Notificaciones.
- Eventos colaborativos.
- Actualizaciones instantáneas.
- Comunicación bidireccional.

---

# Seguridad

## Implementaciones actuales

- JWT Authentication.
- Authorization Middleware.
- Validaciones Zod.
- Manejo centralizado de errores.
- Separación de capas.

---

## Mejoras futuras

- Rate limiting.
- Helmet.
- Refresh tokens.
- Auditoría.
- Logs avanzados.
- Protección CSRF.

---

# Manejo de Errores

El sistema utiliza:

```bash
AppError
```

Para:

- Errores personalizados.
- Respuestas consistentes.
- Debugging centralizado.

---

# Validaciones

El sistema utiliza:

```bash
Zod
```

Para:

- Validación de requests.
- Validación de DTOs.
- Prevención de datos inválidos.

---

# Dockerización

## Dockerfile incluido

El proyecto incluye soporte Docker.

---

## Build Docker

```bash
docker build -t workhub-backend .
```

---

## Ejecutar contenedor

```bash
docker run -p 4000:4000 workhub-backend
```

---

# Solución Error TypeScript con PG

## Error común

```bash
Could not find a declaration file for module 'pg'
```

---

## Solución

```bash
npm install --save-dev @types/pg
```

---

# Solución para otras librerías

```bash
npm install -D @types/socket.io
npm install -D @types/nodemailer
npm install -D @types/jsonwebtoken
npm install -D @types/bcrypt
```

---

# Buenas Prácticas Implementadas

- Arquitectura modular.
- Separación de responsabilidades.
- Validaciones centralizadas.
- Reutilización de utilidades.
- Manejo global de errores.
- Comunicación desacoplada.
- Tipado fuerte con TypeScript.

---

# Flujo de Desarrollo Recomendado

```text
Crear módulo
   ↓
Definir schema
   ↓
Crear controller
   ↓
Crear service
   ↓
Crear repository
   ↓
Agregar rutas
   ↓
Testing
```

---

# Integración con Frontend

El backend está diseñado para integrarse con:

- Next.js Frontend.
- JWT Authentication.
- Socket.IO.
- APIs REST.

---

# Escalabilidad

La arquitectura permite agregar fácilmente:

- Nuevos módulos.
- Nuevos middlewares.
- Nuevas integraciones.
- Nuevos servicios.
- Nuevos eventos websocket.

---

# Roadmap Futuro

| Etapa | Objetivo |
|---|---|
| 1 | Swagger completo |
| 2 | Testing automatizado |
| 3 | Refresh tokens |
| 4 | Redis cache |
| 5 | Observabilidad |
| 6 | Microservicios |

---

# Estado Actual del Proyecto

## Implementado

- Arquitectura modular.
- JWT Authentication.
- Roles.
- Reservaciones.
- PostgreSQL.
- Socket.IO.
- Validaciones.
- Middleware global.
- Manejo de errores.

---

## Pendiente

- Testing automatizado.
- Swagger avanzado.
- Auditoría.
- Optimización avanzada.
- Escalabilidad distribuida.

---

# Licencia

Uso académico y educativo.