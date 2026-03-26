import swaggerJSDoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJSDoc({
    definition: {
        openapi: "3.0.3",
        info: {
            title: "Mi API",
            version: "1.0.0",
        },
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT"
                }
            }
        },
        security: [
            { BearerAuth: [] }
        ]
    },
    apis: [
        "./src/modules/**/*.ts",
        "./src/routes/**/*.ts"
    ]
});