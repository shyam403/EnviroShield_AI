# EnviroShield AI Complete Startup Guide

To start the completely offline-first EnviroShield AI telemetry pipeline and React application, follow these sequential steps in 4 separate terminal windows.

## 1. Start Local Backend
This starts the local SQLite database, Alert Engine, and WebSocket gateway.
```bash
cd C:/Users/mogal/zephyrproject/enviroshield/backend
node server.js
```
*(Wait until it says "EnviroShield Local Backend running on http://localhost:3001")*

## 2. Start Renode Simulation
This starts the STM32 hardware emulator running the Zephyr RTOS firmware.
```bash
renode C:/Users/mogal/zephyrproject/enviroshield/enviroshield.resc
```

## 3. Start Serial Bridge
This connects the Renode hardware UART emission to the Local Backend and exposes a control port so the frontend can inject commands into Renode.
```bash
python C:/Users/mogal/zephyrproject/enviroshield/serial_bridge.py
```
*(You should start seeing "RX: ..." telemetry events flowing.)*

## 4. Start Frontend
This runs the main EnviroShield web dashboard.
```bash
cd C:/Users/mogal/OneDrive/Documents/enviroshield-floodsafe-integrated/EnviroShield_AI
npm run dev
```

---

## 5. Using the Application

Open `http://localhost:5173`. Login using the demo credentials (if requested): `demo@enviroshield.ai` / `password123`.

On the Home Tab, find the **Renode Simulation Control** panel:
*   **Automatic Mode**: Renode generates realistic telemetry internally inside Zephyr.
*   **Manual Mode**: Enter exact values for Water Clearance (Flood), Air Quality, Seismic Activity (Earthquake), and Water Purity. Click **Apply Values to Simulation** to command Zephyr directly.
*   **High Flood Risk Scenario**: Activating this sends `CMD:SCENARIO:FLOOD` directly to Zephyr, which then creates a deteriorating flood state. Watch the Frontend Critical banner trigger completely organically from the local alert engine via websocket.