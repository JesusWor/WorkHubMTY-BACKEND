# WorkHubMTY-BACKEND

```
├── src
│   ├── app
│   │   └── container.ts
│   ├── config
│   ├── docs
│   │   └── swagger.ts
│   ├── infra
│   │   └── db
│   │       └── db.ts
│   ├── shared
│   │   ├── errors
│   │   │   └── AppError.ts
│   │   └── response
│   │       └── globalresponse.ts
│   ├── app.ts
│   └── server.ts
├── .gitignore
├── Dockerfile
├── README.md
├── package-lock.json
├── package.json
└── tsconfig.json
```
## Dependencies
```bash
npm install express cors mysql2 zod pg dotenv socket.io nodemailer jsonwebtoken uuid
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
