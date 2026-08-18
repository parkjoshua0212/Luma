import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Luma API',
      version: '1.0.0',
      description: 'Backend API for Luma — an AI language conversation practice app'
    },
    servers: [
      { url: 'https://luma-api-djcb.onrender.com', description: 'Production (Render)' },
      { url: 'http://localhost:3000', description: 'Local dev server' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./routes/*.js'] // reads JSDoc comments from your route files
};

export const swaggerSpec = swaggerJSDoc(options);