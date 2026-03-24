# TaskBolt - Multi-Tenant Task Management Platform

**A comprehensive, feature-rich project management SaaS built with Rust + Angular**

[![Tech Stack](https://img.shields.io/badge/Backend-Rust%201.93-orange)](https://www.rust-lang.org/)
[![Tech Stack](https://img.shields.io/badge/Frontend-Angular%2019-red)](https://angular.io/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%2016-blue)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green)]()

---

## 🚀 Features

TaskBolt is a production-ready task management platform with 94% feature parity to enterprise PM tools like Jira and Asana.

### 📊 Core Task Management
- **Board View (Kanban)** - Drag-and-drop task cards between columns
- **List View** - Traditional task list with sorting and filtering
- **Calendar View** - Monthly/weekly task visualization
- **Gantt View** - Custom SVG timeline with dependency arrows
- **Eisenhower Matrix** ⭐ NEW - 2×2 prioritization grid (Urgent/Important axes)

### ⚡ Advanced Features
- **Subtasks** - 2-level task hierarchy with progress tracking
- **Dependencies** - 4 dependency types (FS, SS, FF, SF) with circular detection
- **Recurring Tasks** - Cron-based task automation
- **Milestones** - Project checkpoint tracking
- **Custom Fields** - Per-board customizable fields (text, number, date, dropdown, checkbox)
- **Time Tracking** - Start/stop timer with duration logging
- **Labels/Tags** - Color-coded multi-label assignment
- **Bulk Actions** - Multi-select operations (update, delete, archive)

### 🎯 Productivity Tools
- **My Work Timeline** ⭐ NEW - 7-group task organization:
  - Overdue (red) | Today (blue) | This Week (green) | Next Week (purple)
  - Later (gray) | No Due Date (gray) | Completed Today (green)
- **Enhanced Dashboard** ⭐ NEW - 9 comprehensive widgets:
  - Summary Cards (Total Tasks, Overdue, Due Today, Completed This Week)
  - Tasks by Status (donut chart)
  - Tasks by Priority (bar chart)
  - Overdue Tasks Table (clickable)
  - Completion Trend (30/60/90 day toggle)
  - Upcoming Deadlines Timeline
  - Recent Activity Feed

### 👥 Collaboration
- **Real-Time Updates** - WebSocket-based live collaboration
- **Comments & @Mentions** - Threaded discussions with user tagging
- **File Attachments** - Upload and manage task files
- **Team Workload** - Capacity visualization and overload alerts
- **Shared Boards** - Client portal with read-only access
- **Activity Log** - Comprehensive audit trail

### 🔧 Automation & Integration
- **Workflow Automation** - Trigger-based action rules
- **Webhooks** - Event-driven integrations (task.created, task.updated, etc.)
- **Project Templates** - Reusable board blueprints
- **Import/Export** - CSV/JSON data migration
- **Notifications** - Multi-channel alerts (In-app, Email, Slack via Novu)

### 🛡️ Administration
- **Multi-Tenancy** - Workspace-based isolation
- **Role-Based Access** - Admin/Manager/Member permissions
- **User Management** - Team invite and user provisioning
- **Audit Log** - Full activity tracking
- **Trash & Recovery** - 30-day soft delete with restore
- **Onboarding Flow** - 4-step guided setup

---

## 🏗️ Tech Stack

### Backend
- **Language:** Rust 1.93
- **Framework:** Axum 0.8 (async web framework)
- **Database:** PostgreSQL 16
- **ORM:** SQLx (compile-time checked queries)
- **WebSocket:** Axum native WebSocket + Redis pub/sub for scaling
- **Authentication:** JWT-based with bcrypt password hashing
- **Deployment:** Docker Compose

### Frontend
- **Framework:** Angular 19 (standalone components)
- **State Management:** Signals (built-in reactive primitives)
- **UI Components:** Angular Material + Tailwind CSS 4
- **Change Detection:** OnPush strategy for performance
- **WebSocket:** RxJS-based WebSocket client
- **Build:** Angular CLI with ESBuild

### Infrastructure
- **Container:** Docker + Docker Compose
- **Database:** PostgreSQL 16 with connection pooling
- **Reverse Proxy:** Nginx (production)
- **Storage:** File system (attachments)
- **Notifications:** Novu (multi-channel)

---

## 📦 Installation

### Prerequisites
- Docker 24.0+
- Docker Compose 2.0+
- Git

### Quick Start (Development)

```bash
# 1. Clone repository
git clone <repository-url>
cd taskbolt

# 2. Start services with Docker Compose
docker compose up -d

# 3. Run database migrations
docker compose run --rm backend-migration

# 4. Access application
# Frontend: http://localhost:4200
# Backend API: http://localhost:3000
```

### Environment Variables

Create `.env` file in project root:

```env
# Database
POSTGRES_USER=taskbolt
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=taskbolt
DATABASE_URL=postgresql://taskbolt:your_secure_password@postgres:5432/taskbolt

# Backend
RUST_LOG=info
JWT_SECRET=your_jwt_secret_min_32_chars
ALLOWED_ORIGINS=http://localhost:4200,https://taskflow.paraslace.in

# Notifications (Optional)
NOVU_API_KEY=your_novu_api_key
```

---

## 🚀 Deployment (VPS)

### VPS Requirements
- Ubuntu 22.04+ or Debian 12+
- 2GB RAM minimum (4GB recommended)
- Docker & Docker Compose installed
- Domain with SSL certificate (Let's Encrypt)

### Deployment Steps

```bash
# 1. SSH into VPS
ssh user@your-vps-ip

# 2. Clone repository
cd /root
git clone <repository-url> taskbolt
cd taskbolt

# 3. Create production .env file
cp .env.example .env
nano .env  # Edit with production values

# 4. Verify Rust 1.93 in Dockerfile
head -10 backend/Dockerfile
# Expected: FROM rust:1.93-slim

# 5. Build and start services
docker compose build --no-cache
docker compose up -d

# 6. Run database migrations
docker compose run --rm backend-migration

# 7. Verify services
docker compose ps
docker compose logs -f
```

### Production Configuration

**Nginx reverse proxy config (`/etc/nginx/sites-available/taskbolt`):**

```nginx
server {
    listen 80;
    server_name taskflow.paraslace.in;

    location / {
        proxy_pass http://localhost:4200;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📚 Architecture

### Backend Structure
```
backend/
├── crates/
│   ├── api/          # REST API routes and handlers
│   ├── db/           # Database models, queries, migrations
│   └── common/       # Shared utilities and types
├── Dockerfile        # Multi-stage Rust build
└── Cargo.toml        # Workspace configuration
```

### Frontend Structure
```
frontend/
├── src/app/
│   ├── core/         # Services, guards, interceptors
│   ├── features/     # Feature modules (dashboard, board, my-tasks, etc.)
│   ├── shared/       # Shared components and utilities
│   └── models/       # TypeScript interfaces
```

### Database Schema
- Multi-tenant architecture with `organization_id` foreign keys
- Row-level security for data isolation
- Optimized indexes for common queries
- JSONB columns for flexible data (custom fields, status mappings)

### Key Patterns
- **Backend:** `model.rs` + `queries.rs` + `routes.rs` per feature
- **Frontend:** Standalone components with signals, OnPush change detection
- **State:** Service-based state management with RxJS + Signals
- **Real-time:** WebSocket events with Redis pub/sub for multi-instance scaling

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
cargo test
cargo clippy --all-targets --all-features
cargo fmt --check
```

### Frontend Tests
```bash
cd frontend
npm run test
npm run lint
npm run build --configuration production
```

---

## 📖 API Documentation

### Authentication
```bash
# Sign up
POST /api/auth/signup
Body: { "email": "user@example.com", "password": "secure123", "display_name": "John Doe" }

# Sign in
POST /api/auth/signin
Body: { "email": "user@example.com", "password": "secure123" }
Response: { "token": "jwt_token", "user": {...} }
```

### Eisenhower Matrix (New)
```bash
# Get tasks grouped by quadrant
GET /api/eisenhower
Headers: Authorization: Bearer <token>

# Update manual overrides
PUT /api/eisenhower/tasks/:id
Body: { "urgency": true, "importance": false }

# Reset to auto-computation
PUT /api/eisenhower/reset
```

### Dashboard Widgets (New)
```bash
# Tasks by status (donut chart data)
GET /api/dashboard/tasks-by-status

# Tasks by priority (bar chart data)
GET /api/dashboard/tasks-by-priority

# Overdue tasks table
GET /api/dashboard/overdue-tasks?limit=10

# Completion trend
GET /api/dashboard/completion-trend?days=30

# Upcoming deadlines
GET /api/dashboard/upcoming-deadlines?days=14
```

---

## 🎯 Roadmap

### Completed ✅
- [x] Core task management (Board, List, Calendar, Gantt)
- [x] Subtasks, Dependencies, Recurring Tasks
- [x] Custom Fields, Time Tracking, Labels
- [x] Real-time WebSocket updates
- [x] Eisenhower Matrix View (2026-02-11)
- [x] Enhanced My Work Timeline (2026-02-11)
- [x] Enhanced Dashboard Widgets (2026-02-11)

### Planned 🔜
- [ ] Task Groups/Sections (collapsible phases)
- [ ] WhatsApp Integration via WAHA (daily standups, two-way commands) 🎯 KILLER FEATURE
- [ ] Enhanced Comments (emoji reactions, pin, edit/delete)
- [ ] Team Workload widget with capacity tracking
- [ ] Burndown chart widget
- [ ] Customizable dashboard layout (drag-drop widgets)

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Standards
- **Rust:** Follow Rust API guidelines, use `cargo fmt` and `cargo clippy`
- **Angular:** Follow Angular style guide, use `ng lint`
- **Commits:** Conventional Commits format (e.g., `feat:`, `fix:`, `docs:`)

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgements

- **Rust Community** for the amazing ecosystem
- **Angular Team** for signals and standalone components
- **PostgreSQL** for rock-solid reliability
- **Novu** for notification infrastructure

---

## 📞 Support

For issues, questions, or feature requests:
- GitHub Issues: [Create an issue](https://github.com/your-repo/taskbolt/issues)
- Email: support@paraslace.in

---

**Built with ❤️ using Rust + Angular**

**Domain:** [taskflow.paraslace.in](https://taskflow.paraslace.in)
