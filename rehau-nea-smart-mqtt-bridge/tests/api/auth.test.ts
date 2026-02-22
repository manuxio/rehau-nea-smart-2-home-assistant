import request from 'supertest';
import { APIServer } from '../../src/api/server';

describe('Auth API', () => {
  let apiServer: APIServer;
  let app: any;

  beforeAll(() => {
    // Set env vars before creating server
    process.env.API_USERNAME = 'testuser';
    process.env.API_PASSWORD = 'testpass';
    process.env.JWT_SECRET = 'test-secret-key';
    
    apiServer = new APIServer(3001);
    app = apiServer.getApp();
  });

  afterAll(async () => {
    await apiServer.stop();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return token with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'testpass'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body.expiresIn).toBe(86400);
    });

    it('should return 401 with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpass'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 with missing username', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          password: 'testpass'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 with missing password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/auth/status', () => {
    it('should return authenticated false without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/status');

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(false);
    });

    it('should return authenticated true with valid token', async () => {
      // First login to get token
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'testpass'
        });

      const token = loginResponse.body.token;

      // Then check status
      const response = await request(app)
        .get('/api/v1/auth/status')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(true);
    });
  });

  describe('Protected routes', () => {
    it('should return 401 for protected route without token', async () => {
      const response = await request(app)
        .get('/api/v1/status/system');

      expect(response.status).toBe(401);
    });

    it('should allow access to protected route with valid token', async () => {
      // First login
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'testpass'
        });

      const token = loginResponse.body.token;

      // Access protected route
      const response = await request(app)
        .get('/api/v1/status/system')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
    });
  });
});
