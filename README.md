# NexusFlow

A real-time dashboard for dispatching and monitoring BullMQ/Redis-backed jobs with priority levels.

## Local Deployment (Docker Compose)
1. Set up a `.env` file based on `.env.example`.
2. Run `docker-compose up --build`.
3. Open `http://localhost:3000`.

## Production Deployment (Free-tier friendly e.g. Render/Railway)
To deploy on PaaS providers:
1. Ensure `server` and `web` directories are deployed as separate web services.
2. Provision a managed Redis and MongoDB instance.
3. Configure the following environment variables on the `server`:
   - `JWT_SECRET`: A secure random string for JWT signing.
   - `MONGO_URI`: The connection string to your MongoDB instance.
   - `REDIS_URL`: The connection string to your Redis instance.
4. Configure the following environment variable on the `web`:
   - `NEXT_PUBLIC_API_URL`: The deployed URL of your server service.
