# UI Navigator

UI Navigator is a powerful Cloud Orchestrator and Web Dashboard for remote desktop automation and UI navigation. Powered by Google ADK (Agent Development Kit) and Gemini Live API, it enables seamless remote control, voice-directed navigation, and intelligent UI segmentation.

## 🧩 Architecture & Workflows

### System Architecture
<!-- [PASTE SYSTEM ARCHITECTURE DIAGRAM HERE] -->
<!-- Description: "Operon Ai. System Architecture" showing FastAPI Backend, React Frontend, Agent, Local Helper, DB, and Cloud Storage -->

### Overall Navigation Flow
<!-- [PASTE SEQUENCE DIAGRAM: OVERALL NAVIGATION FLOW HERE] -->
<!-- Description: Sequence Diagram showing User -> React Frontend -> Backend API -> AI Navigator Agent -> Local Device Agent -->

### WebSocket Real-Time Communication
<!-- [PASTE SEQUENCE DIAGRAM: WEBSOCKET COMMUNICATION HERE] -->
<!-- Description: Sequence Diagram detailing the frame capture, AI processing, and command execution loop -->

### AI Navigator Agent Loop
<!-- [PASTE STATE DIAGRAM: AI NAVIGATOR AGENT LOOP HERE] -->
<!-- Description: State machine depicting Idle -> Perceiving -> Planning -> Executing -> Verifying -> Logging -->

<!-- [ADD SCREENSHOT HERE: Main Dashboard Overview] -->

## 🌟 Key Features

- **Centralized Orchestration**: A FastAPI backend manages WebSocket connections from multiple local desktop clients and web dashboards.
- **Voice-Directed Control**: Real-time voice control capable of listening to commands and steering desktop automation. Uses Google ADK and Gemini's bidi-streaming capabilities.
- **Intelligent UI Segmentation**: Server-side processing utilizing YOLO and EasyOCR to detect, segment, and understand UI elements from desktop screenshots.
- **Real-time Local Execution**: A lightweight desktop GUI (Local Helper) captures local screens and executes native OS commands (click, type, scroll, hotkeys).
- **Secure Handling**: Robust MongoDB-backed authentication and device pairing system.

<!-- [ADD SCREENSHOT HERE: UI Segmentation Output / Annotated Screen showing detected elements] -->

## 🏗️ Project Structure

The repository is modularized into three main components and infrastructure code:

```text
.
├── client/         # React & Vite web dashboard (Next-gen UI with Tailwind & Shadcn)
├── server/         # FastAPI cloud orchestrator (WebSockets, AI Segmentation pipelines)
├── local-helper/   # Python desktop automation client (Captures screen & runs GUI actions)
└── terraform/      # GCP infrastructure deployment (Cloud Run, IAM, GCS, Artifact Registry)
```

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v18+` (for the Web Client)
- **Python**: `>=3.12` (for Server and Local Helper)
- **Package Manager**: [uv](https://github.com/astral-sh/uv) is highly recommended for Python dependencies.
- **Database**: MongoDB instance (local or Atlas)

### 1. Server (Cloud Orchestrator)
The backend orchestrates WebSocket messages, handles voice audio streams, and does heavy lifting with UI segmentation.

```bash
cd server
# Install dependencies using uv
uv sync
```

**Environment Variables (`server/.env`):**
```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=ui_navigator
# Add other necessary keys like GEMINI_API_KEY if required
```

**Run the server:**
```bash
uvicorn server.main:app --reload
# or with normal Python
python main.py
```
<!-- [ADD SCREENSHOT HERE: Server terminal output showing successful startup and WebSocket routes] -->

### 2. Web Client (Dashboard)
The dashboard provides a visual interface to manage connected systems and sessions.

```bash
cd client
npm install
npm run dev
```

Open your browser to `http://localhost:5173` to see the dashboard.
<!-- [ADD SCREENSHOT HERE: Web Dashboard Home Page with connected devices] -->

### 3. Local Helper (Desktop GUI)
The local helper runs on the target machine. It connects to the server to receive automation commands and send back screen recordings/segmentation frames.

```bash
cd local-helper
uv sync
uv run python main.py
```

In the Local Helper GUI, provide the server URL (e.g., `ws://localhost:8000`) and the `DEVICE_TOKEN` generated from your Web Dashboard.
<!-- [ADD SCREENSHOT HERE: Local Helper Desktop GUI showing connection status] -->

## ☁️ Deployment

The project contains complete Infrastructure as Code (IaC) to deploy the backend to Google Cloud Provider (GCP).

- **Terraform (`/terraform`)**: Sets up Artifact Registry, Cloud Run, Cloud Storage, and necessary IAM policies.
- **Cloud Build (`cloudbuild.yaml`)**: Automatically triggered on pushes to the `main` branch. It builds the Docker image and deploys the `operon-server` to Google Cloud Run. 

<!-- [ADD SCREENSHOT HERE: Architecture Diagram for GCP Deployment (Cloud Build -> Artifact Registry -> Cloud Run)] -->

## 🤝 Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
