# WorkHubMTY-BACKEND

```
├── 📁 src
│   ├── 📁 app
│   │   ├── 📁 controllers
│   │   │   └── 📄 notification.controller.ts
│   │   ├── 📁 routes
│   │   │   └── 📄 notification.routes.ts
│   │   ├── 📁 services
│   │   │   ├── 📄 email.service.ts
│   │   │   └── 📄 notification.service.ts
│   │   └── 📄 container.ts
│   ├── 📁 config
│   │   └── 📄 mail.config.ts
│   ├── 📁 docs
│   │   └── 📄 swagger.ts
│   ├── 📁 infra
│   │   ├── 📁 db
│   │   │   └── 📄 db.ts
│   │   └── 📁 websocket
│   │       ├── 📄 socket.server.ts
│   │       └── 📄 socket.types.ts
│   ├── 📁 middleware
│   │   ├── 📄 auth.middleware.ts
│   │   ├── 📄 index.ts
│   │   └── 📄 role.middleware.ts
│   ├── 📁 modules
│   │   ├── 📁 role
│   │   │   ├── 📄 index.ts
│   │   │   ├── 📄 role.controller.ts
│   │   │   ├── 📄 role.repo.ts
│   │   │   ├── 📄 role.router.ts
│   │   │   ├── 📄 role.schema.ts
│   │   │   └── 📄 role.service.ts
│   │   └── 📁 user
│   │       ├── 📄 index.ts
│   │       ├── 📄 user.controller.ts
│   │       ├── 📄 user.repo.ts
│   │       ├── 📄 user.router.ts
│   │       ├── 📄 user.schema.ts
│   │       └── 📄 user.service.ts
│   ├── 📁 routes
│   │   ├── 📄 generate-token.router.ts
│   │   ├── 📄 health.router.ts
│   │   └── 📄 index.ts
│   ├── 📁 shared
│   │   ├── 📁 errors
│   │   │   └── 📄 AppError.ts
│   │   ├── 📁 response
│   │   │   └── 📄 globalresponse.ts
│   │   ├── 📁 schemas
│   │   │   └── 📄 auth.schema.ts
│   │   ├── 📁 types
│   │   │   ├── 📄 email.types.ts
│   │   │   ├── 📄 express.d.ts
│   │   │   └── 📄 notifications.types.ts
│   │   └── 📁 utils
│   │       ├── 📄 guid.util.ts
│   │       ├── 📄 jwt.util.ts
│   │       └── 📄 logger.util.ts
│   ├── 📄 app.ts
│   └── 📄 server.ts
├── ⚙️ .env.example
├── ⚙️ .gitignore
├── 🐳 Dockerfile
├── 📝 README.md
├── ⚙️ package-lock.json
├── ⚙️ package.json
└── ⚙️ tsconfig.json
```

---
## Dependencies
```bash
npm install express cors mysql2 zod pg dotenv socket.io nodemailer jsonwebtoken uuid swagger-ui-express
```
You need install this dependencies to run the code

## 🚨 Common Error: Could not find a declaration file for module 'pg'

### Description

When using **TypeScript** with the `pg` library (PostgreSQL client for Node.js), you might encounter the following error:

```
Could not find a declaration file for module 'pg'.
'C:/.../node_modules/pg/lib/index.js' implicitly has an 'any' type.
```

This happens because **TypeScript cannot find the type definitions for the `pg` package**.

### Solution

Install the official type definitions as a development dependency:

```bash
npm install --save-dev @types/pg
```

After installing the types, restart your development server or VS Code if the error persists.

### Alternative (not recommended)

If you cannot install the types, you can create a custom declaration file.

Create a file:

```
types/pg.d.ts
```

And add:

```ts
declare module "pg";
```

However, installing `@types/pg` is the recommended approach because it provides full TypeScript support.
You can apply the same thing for nodeamiler and socket
```
npm install -D @types/socket.io
npm install -D @types/nodemailer
npm install -D @types/jsonwebtoken
```
More dependencies yo will need
```
npm install -D @types/bcrypt
```