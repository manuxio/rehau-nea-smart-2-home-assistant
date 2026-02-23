# REHAU NEA Smart 2.0 - Web UI

Mobile-first web interface for controlling REHAU NEA Smart 2.0 heating system.

## Features

- 🔐 JWT Authentication
- 📱 Mobile-first responsive design
- 🎨 Modern, clean UI
- ⚡ Real-time updates (WebSocket ready)
- 📊 System status monitoring

## Development

```bash
# Install dependencies
npm install

# Start dev server (requires API server running on port 3000)
npm run dev

# Build for production
npm run build
```

## Environment Variables

Create a `.env` file:

```
VITE_API_URL=http://localhost:3000
```

## Pages

- `/login` - Authentication
- `/` - Dashboard with system status
- More pages coming soon (zones, logs, settings)

## Tech Stack

- React 19
- TypeScript
- Vite
- React Router
- Zustand (state management)
- Axios (API client)

## Integration

The built web UI is served by the API server at `http://localhost:3000/`
