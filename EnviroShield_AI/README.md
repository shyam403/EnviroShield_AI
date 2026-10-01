# 🌍 EnviroShield AI

**AI-Powered Environmental Monitoring & Early Warning System**

EnviroShield AI is a smart environmental monitoring system designed to detect and monitor environmental hazards such as **flooding, forest fires, air pollution, and abnormal environmental conditions**.

The project combines **IoT sensors, embedded systems, real-time data processing, AI-based analysis, and a web dashboard** to provide early warnings and help users understand changing environmental conditions.

---

## 🚨 Problem

Environmental hazards can develop quickly, and delayed information can make it difficult to respond on time.

Traditional monitoring systems may depend on manual observation or isolated sensors. EnviroShield AI aims to bring sensor data into a single monitoring platform where environmental conditions can be observed and potential hazards can be identified earlier.

---

## 💡 Our Solution

EnviroShield AI collects environmental data from sensors and sends it to a backend system for processing.

The processed information is displayed through a web dashboard with:

* 📊 Real-time sensor readings
* 🚨 Hazard alerts
* 🌊 Flood-level monitoring
* 🔥 Fire/environmental hazard detection
* 🌱 Environmental condition monitoring
* 📈 Historical/replayed sensor data
* 🖥️ Web-based monitoring dashboard

The system can also be demonstrated using **Renode**, allowing sensor values and embedded-system behavior to be tested without depending completely on physical hardware.

---

## 🏗️ System Architecture

```text
┌─────────────────────┐
│   Physical Sensors  │
│                     │
│  Ultrasonic Sensor  │
│  Environmental      │
│  Sensors            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Embedded Controller │
│                     │
│ Arduino / ESP32 /   │
│ STM32 / Zephyr      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Data Processing   │
│      Backend        │
│                     │
│ API + Processing    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    AI / Analysis    │
│                     │
│ Risk Detection &    │
│ Alert Generation    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    Web Dashboard    │
│                     │
│ Sensors | Alerts    │
│ Monitoring | Status │
└─────────────────────┘
```

---

## 🔧 Hardware

The prototype can be demonstrated using embedded hardware and sensors such as:

* Microcontroller development board
* HC-SR04 ultrasonic sensor
* LEDs for status indication
* Buzzer for alerts
* Environmental sensors where available

The hardware layer is responsible for collecting sensor values and communicating them to the monitoring system.

---

## 🧪 Renode Simulation

EnviroShield AI also uses **Renode** for embedded-system simulation and repeatable demonstrations.

Renode makes it possible to test the embedded application and simulate sensor-related scenarios without requiring physical hardware for every test.

Example workflow:

```text
Renode
   ↓
Virtual Sensor Values
   ↓
Embedded Application
   ↓
Backend / Serial Bridge
   ↓
EnviroShield Dashboard
```

This approach is useful for development, testing, debugging, and demonstrations.

---

## 💻 Software Stack

### Frontend

* React
* JavaScript
* HTML
* CSS
* Vite

### Backend

* Node.js
* Express.js
* REST APIs

### Database

* MongoDB

### Embedded / Simulation

* Zephyr RTOS
* Renode
* Microcontroller-based hardware

### AI Layer

The AI layer can be used to analyze environmental readings, identify abnormal patterns, and support hazard-risk alerts.

---

## 📊 Dashboard

The dashboard is designed to provide a simple view of the current environmental status.

It can include:

* Sensor readings
* Current hazard status
* Alert notifications
* System status
* Historical data
* Environmental trends
* Simulation/replay information

---

## 🔔 Alert System

When sensor values cross configured thresholds or abnormal patterns are detected, the system can generate an alert.

Example:

```text
Normal
   ↓
Sensor value increases
   ↓
Threshold / abnormal condition detected
   ↓
Risk analysis
   ↓
Warning generated
   ↓
Dashboard + Alert notification
```

---

## 📁 Project Structure

```text
EnviroShield_AI/
│
├── frontend/              # Web dashboard
│
├── backend/               # Server and APIs
│
├── embedded/              # Embedded/Zephyr application
│
├── renode/                # Renode simulation files
│
├── docs/                  # Project documentation
│
└── README.md
```

> Folder names may differ depending on the current implementation of the project.

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd EnviroShield_AI
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Start the frontend

```bash
npm run dev
```

### 4. Install backend dependencies

Open another terminal:

```bash
cd backend
npm install
```

### 5. Start the backend

```bash
npm run dev
```

The exact commands may vary depending on the final project configuration.

---

## 🧪 Testing with Renode

If the Renode simulation environment is configured:

1. Open the Renode project.
2. Load the required `.resc` script.
3. Start the embedded application.
4. Provide or simulate sensor values.
5. Monitor the generated data.
6. Observe the corresponding status and alerts on the dashboard.

---

## 🎯 Key Features

* 🌍 Environmental monitoring
* 🌊 Flood-level monitoring
* 🔥 Hazard detection
* 📡 Sensor-based data collection
* 🤖 AI-assisted environmental analysis
* 🚨 Early warning alerts
* 📊 Interactive dashboard
* 🧪 Renode-based simulation
* 🔄 Sensor-data replay/testing
* 💻 Web-based monitoring

---

## 🔮 Future Scope

Possible future improvements include:

* Integration of additional environmental sensors
* More advanced AI-based anomaly detection
* Machine-learning-based risk prediction
* Cloud deployment
* Mobile application
* SMS and emergency notification integration
* Larger-scale IoT sensor networks
* GIS/map-based environmental monitoring
* Long-term environmental data analysis

---

## 🌱 Vision

The goal of EnviroShield AI is to create a scalable monitoring platform that connects **sensors, embedded systems, AI, and real-time dashboards** to support faster awareness of environmental hazards.

> **Sense. Analyze. Alert. Protect.**

---

## 👥 Team

**Team:** FRIENDS

**Project:** EnviroShield AI

Developed as a technology solution for environmental monitoring and early-warning use cases.

---

## 📜 License

This project is developed for educational, research, and demonstration purposes.
