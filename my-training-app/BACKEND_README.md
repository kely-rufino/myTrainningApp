# My Training App - Backend Integration

This application now includes an Express backend that logs each increment button click to the console.

## 🚀 How to run

### Option 1: Run everything together (Recommended)
```bash
npm run dev:full
```
This command runs the backend server (port 3001) and frontend (port 5173) simultaneously.

### Option 2: Run separately

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## 🛠️ Features

- **Frontend**: React interface with increment, decrement, and reset buttons
- **Backend**: Express server on port 3001 that:
  - Logs "Plus 1" to console on each increment button click
  - Maintains counter state
  - Provides REST endpoints for all operations

## 📡 API Endpoints

- `GET /api/counter` - Get current counter value
- `POST /api/counter/increment` - Increment counter (logs "Plus 1" to console)
- `POST /api/counter/decrement` - Decrement counter
- `POST /api/counter/reset` - Reset counter to 0
- `GET /api/health` - Check if server is running

## 💡 Expected Behavior

When you click the "+" (increment) button in the interface:
1. Frontend makes a POST request to `/api/counter/increment`
2. Server processes the request and prints "Plus 1" to console
3. Server returns the new counter value
4. Interface is updated with the new value

## 🔧 Technologies

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Tools**: Concurrently for simultaneous execution

## 📝 Server Logs

The server logs the following events to console:
- ✅ Server initialization
- 📊 Counter queries
- **"Plus 1"** - On each increment (as requested)
- 📈 Increments with new value
- 📉 Decrements with new value
- 🔄 Counter resets