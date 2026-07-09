const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'StayMaster API Documentation',
      version: '1.0.0',
      description: 'API Documentation for StayMaster Backend services including Zoop Gateway integration.',
    },
    servers: [
      {
        url: 'http://localhost:8085',
        description: 'Local development server',
      },
      {
        url: 'http://localhost:8080',
        description: 'Alternative local port',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [path.join(__dirname, '../routes/*.js')], // Use absolute path
};

const specs = swaggerJsdoc(options);

module.exports = specs;
