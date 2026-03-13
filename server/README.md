## UI Navigator Server

### Authentication storage (MongoDB)

User login/signup credentials are stored in MongoDB.

- `MONGODB_URI` (example: `mongodb://localhost:27017`)
- `MONGODB_DB_NAME` (example: `ui_navigator`)

Passwords are stored as salted PBKDF2 hashes.

### Device pairing metadata

Pairing token creation now accepts metadata and stores it in MongoDB.

- Endpoint: `POST /api/devices/token?token=<user_token>`
- Body:
	- `device_name`: string
	- `session_minutes`: integer (15..1440)
- Response includes:
	- `device_token`, `device_id`, `device_name`, `session_minutes`, `expires_at`

### Active systems

- Endpoint: `GET /api/systems/active?token=<user_token>`
- Returns currently connected systems and online count.

### Server-side segmentation

The server now hosts the UI segmentation pipeline (YOLO + OCR).

- Endpoint: `POST /api/segment?token=<device_token>`
- Auth: requires a valid device token.
- Request body:
	- `image_b64`: JPEG screenshot as base64
	- `logical_width`: logical desktop width
	- `logical_height`: logical desktop height
	- `scale_factor`: HiDPI scale
	- `quality`: output JPEG quality (30..95)
- Response:
	- `screenshot`: annotated screenshot (base64)
	- `elements`: detected UI elements
	- `screen_info`: screen metadata
	- `stats`: segmentation timing and confidence metrics
