# UI Navigator

<div align="center">

<img width="600" height="162" alt="logo" src="https://github.com/user-attachments/assets/1e8cfcae-d854-428a-9140-b48094d9f19b" />


### Your Intelligent Cloud Orchestrator for Remote Automation

Master desktop environments, automate complex workflows, and navigate seamlessly with a real-time Operon AI.

</div>

---

<img width="1919" height="867" alt="image" src="https://github.com/user-attachments/assets/d77340e2-3fff-4caf-bc66-9250e5e1e53c" />


**UI Navigator** is a powerful Cloud Orchestrator and Web Dashboard for remote desktop automation and UI navigation. Powered by Google ADK (Agent Development Kit) and the Gemini Live API, it enables seamless remote control, voice-directed navigation, and intelligent UI segmentation into a single unified experience. It goes beyond typical screencasting by integrating state-of-the-art AI to dynamically understand application interfaces, segment elements via YOLO & EasyOCR, and orchestrate native desktop actions in real-time.


## 🌟 The Core Features

### 1. Centralized Cloud Orchestration
Manage multiple connected systems seamlessly from a single unified server.

<img width="1916" height="870" alt="devices-1" src="https://github.com/user-attachments/assets/5f86bad1-4f91-42a8-b28e-01d153b3f992" />


**Advanced Device Management:**
- **Real-Time Dashboards** - Visually manage connected systems and active sessions.
- **WebSocket Foundation** - Low latency bidirectional comms for ultra-fast action execution.
- **Secure Handling** - Robust MongoDB-backed authentication and device pairing system.
- **Session Histories** - Keep accurate logs of AI navigation sessions and recorded actions.

---

### 2. Voice-Directed AI Control
Real-time voice-based control using the Gemini Live API to interpret intent and execute complex desktop actions effortlessly.

<img width="1915" height="863" alt="dashboard-1" src="https://github.com/user-attachments/assets/782d37e3-d369-488a-a346-2023316f4c83" />


- **Voice Commands** - Navigate applications, click elements, or type text using natural language.
- **Bidi-Streaming** - Utilizes Google ADK for ultra-fast audio ingestion and generation.
- **Context-Aware Interactions** - Ask questions about what the agent "sees" on the remote screen.
- **Adaptive Execution** - The AI adapts strategies dynamically if a UI element cannot be found or actions fail.

---

### 3. Intelligent Server-Side UI Segmentation
Transform flat screenshots into structured, actionable data objects using advanced vision pipelines.

<img width="1918" height="867" alt="session-1" src="https://github.com/user-attachments/assets/7f1b8ee2-52fc-43a5-b4d1-c617c6a1cb1f" />


**Perception Workflow:**
```
Capture Framework → Object Detection (YOLO) → Optical Character Recognition (EasyOCR) → Structured Mapping
```

- **Bounding Box Creation** - Accurately identifies interactive elements (buttons, inputs, links).
- **Text Extraction** - Captures embedded application text to enrich the agent's spatial awareness.
- **Scale-Factor Support** - Handles varying structural logical widths, heights, and HiDPI displays natively.
- **Confidence Metrics** - Reports segmentation timing and confidence scores for reliable operation.

---

### 4. Real-time Local Desktop Execution
The lightweight Desktop GUI ("Local Helper") runs directly on the target machine ensuring fast, native actions.

<img width="1233" height="812" alt="app-1" src="https://github.com/user-attachments/assets/b99442a3-b246-4e7a-9909-3ed55ca221d5" />


- **Direct OS Integration** - Executes OS-level commands (clicks, typing, keyboard shortcuts, scrolls).
- **Responsive Frame Capture** - Takes compressed JPEG screenshots only when requested to save bandwidth.
- **Easy Setup** - Simply requires a Server URL and a Web-Dashboard generated Device Token.
- **Headless Options** - Can function passively in the background awaiting orchestrator commands.

---

## 🧩 Architecture & Workflows

### System Architecture

![1](https://github.com/user-attachments/assets/bb909386-23ee-42b1-8905-9ac3fb8765ce)

<!-- [PASTE SYSTEM ARCHITECTURE DIAGRAM HERE] -->
<!-- Description: "Operon Ai. System Architecture" showing FastAPI Backend, React Frontend, Agent, Local Helper, DB, and Cloud Storage -->

### Overall Navigation Flow

![2](https://github.com/user-attachments/assets/4fe51095-245e-40c5-a430-1ec7c53da94e)
<!-- [PASTE SEQUENCE DIAGRAM: OVERALL NAVIGATION FLOW HERE] -->
<!-- Description: Sequence Diagram showing User -> React Frontend -> Backend API -> AI Navigator Agent -> Local Device Agent -->

### WebSocket Real-Time Communication
![3](https://github.com/user-attachments/assets/0bbd1b15-b81c-4ec9-b45d-ed8e86bb73cc)
<!-- [PASTE SEQUENCE DIAGRAM: WEBSOCKET COMMUNICATION HERE] -->
<!-- Description: Sequence Diagram detailing the frame capture, AI processing, and command execution loop -->

### AI Navigator Agent Loop
![4](https://github.com/user-attachments/assets/4315c29e-6a46-4125-95f3-d41e1c30e050)
<!-- [PASTE STATE DIAGRAM: AI NAVIGATOR AGENT LOOP HERE] -->
<!-- Description: State machine depicting Idle -> Perceiving -> Planning -> Executing -> Verifying -> Logging -->

---

## 🛠️ Tech Stack

### Web Client (Dashboard)
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.2 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 7.2 | Build tool & dev server |
| Tailwind CSS | 4.1.17 | Utility-first styling |
| React Router | 7.13 | Client-side routing |
| Motion | 12.36 | Animations & transitions |
| shadcn/ui + Radix | — | UI components & primitives |

### Python Server (Cloud Orchestrator)
| Technology | Version | Purpose |
|-----------|---------|---------|
| FastAPI | 0.115+ | Async HTTP framework |
| Uvicorn | 0.30+ | ASGI server |
| WebSockets | 13.0+ | Real-time bidirectional comms |
| Google ADK | 1.0+ | Agent orchestration |
| Motor/MongoDB | 4.10+ | Persistent database and pairing |
| Ultralytics (YOLO) | 8.0+ | Object segmentation |
| EasyOCR | 1.7+ | Optical Character Recognition |

### Desktop Client (Local Helper)
| Technology | Purpose |
|-----------|---------|
| Python | Core scripting language |
| WebSockets | connection pipeline |
| Native OS libraries | Automated input action triggers |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| Google Cloud Run | Server deployment |
| Cloud Storage (GCS)| Artifact & screenshot retention |
| Artifact Registry | Docker container management |
| Terraform | IaC automated provisioning |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18+`
- **Python**: `>=3.12`
- **Package Manager**: [uv](https://github.com/astral-sh/uv) (Highly recommended for Python)
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
```

**Run the server:**
```bash
uvicorn server.main:app --reload
# or
python main.py
```

### 2. Web Client (Dashboard)
The dashboard provides a visual interface to manage connected systems and sessions.

```bash
cd client
npm install
npm run dev
```

Open your browser to `http://localhost:5173` to see the dashboard.

### 3. Local Helper (Desktop GUI)
The local helper runs on the target machine.

```bash
cd local-helper
uv sync
uv run python main.py
```

In the Local Helper GUI, provide the server URL (e.g., `ws://localhost:8000`) and the `DEVICE_TOKEN` generated from your Web Dashboard.

---

## ☁️ Deployment

The project contains complete Infrastructure as Code (IaC) to deploy the backend to Google Cloud Provider (GCP).

- **Terraform (`/terraform`)**: Sets up Artifact Registry, Cloud Run, Cloud Storage, and necessary IAM policies.
- **Cloud Build (`cloudbuild.yaml`)**: Automatically triggered on pushes to the `main` branch. It builds the Docker image and deploys the `operon-server` to Google Cloud Run. 

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">

**Built with ❤️ for powerful automation experiences**

[⬆ Back to Top](#ui-navigator)

</div>
