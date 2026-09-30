# Phase 02: Global Application Shell (`G-001`), System-Wide Detail Drawer (`AR`), Global Search (`SEARCH-001..002`), Notifications (`NOTIF-001..002`), Help & Support (`HELP-001..004`, `SUPPORT-001..006`)

## 1. Phase Overview & Architectural Goal
**Phase 02** builds the unified Next.js 15 App Router shell (`G-001`) shared by every authenticated screen across all 33 modules, the **8-Dimension Global Filter Engine**, the **System-Wide Reusable Right-Side Detail Drawer (`AR`)**, **Federated Global Search (`SEARCH-001..002`)**, **Real-Time Notification Center (`NOTIF-001..002`)**, and **Help & Customer Success Ticketing (`HELP-001..004`, `SUPPORT-001..006`)**.

---

## 2. Database Schemas (MySQL 8.0 InnoDB + ClickHouse)

```sql
-- Saved Global Filter Presets per User (G-001)
CREATE TABLE user_filter_presets (
    id CHAR(36) PRIMARY KEY,
    org_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,                      -- e.g. 'My Core Engineering Team - This Month'
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    filters_json JSON NOT NULL,                      -- { datePreset, deptIds, teamIds, locationIds, managerId, projectIds, clientIds, timezone }
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_preset_user (org_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- In-App & Multi-Channel Notifications Table (NOTIF-001..002)
CREATE TABLE notifications (
    id CHAR(36) PRIMARY KEY,                         -- UUIDv7
    org_id CHAR(36) NOT NULL,
    recipient_user_id CHAR(36) NOT NULL,
    category ENUM('ATTENDANCE','TASKS','PROJECTS','APPROVALS','SECURITY','HR','AI','SYSTEM') NOT NULL,
    severity ENUM('INFO','SUCCESS','WARNING','CRITICAL') NOT NULL DEFAULT 'INFO',
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    action_url VARCHAR(512) NULL,                    -- Deep-link route or `?drawer=...` trigger
    inline_actions_json JSON NULL,                   -- e.g. [{"label":"Approve","method":"POST","url":"/api/v1/leaves/123/approve"}]
    entity_type VARCHAR(64) NULL,                    -- 'EMPLOYEE','TASK','PROJECT','TIMESHEET','LEAVE','ALERT'
    entity_id CHAR(36) NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    read_at DATETIME(3) NULL,
    is_archived TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_notif_user_unread (org_id, recipient_user_id, is_read, is_archived, created_at DESC)
) ENGINE=InnoDB;

-- User Notification Preferences & Quiet Hours (NOTIF-002)
CREATE TABLE user_notification_preferences (
    user_id CHAR(36) NOT NULL,
    org_id CHAR(36) NOT NULL,
    category ENUM('ATTENDANCE','TASKS','PROJECTS','APPROVALS','SECURITY','HR','AI','SYSTEM') NOT NULL,
    in_app_enabled TINYINT(1) NOT NULL DEFAULT 1,
    email_enabled TINYINT(1) NOT NULL DEFAULT 1,
    desktop_toast_enabled TINYINT(1) NOT NULL DEFAULT 1,
    mobile_push_enabled TINYINT(1) NOT NULL DEFAULT 1,
    whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 0,
    quiet_hours_start TIME NULL DEFAULT '21:00:00',
    quiet_hours_end TIME NULL DEFAULT '08:00:00',
    PRIMARY KEY (user_id, category)
) ENGINE=InnoDB;

-- Help Center Knowledge Base Articles (HELP-002 / SUPPORT-005)
CREATE TABLE kb_articles (
    id CHAR(36) PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    slug VARCHAR(200) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    summary VARCHAR(512) NOT NULL,
    content_markdown MEDIUMTEXT NOT NULL,
    video_url VARCHAR(512) NULL,
    target_roles_json JSON NOT NULL,                 -- ["ADMIN","MANAGER","EMPLOYEE"]
    helpful_yes_count INT UNSIGNED NOT NULL DEFAULT 0,
    helpful_no_count INT UNSIGNED NOT NULL DEFAULT 0,
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    FULLTEXT INDEX ft_kb_search (title, summary, content_markdown)
) ENGINE=InnoDB;

-- Customer Support Tickets & SLA Tracking (HELP-003 / SUPPORT-001..004)
CREATE TABLE support_tickets (
    id CHAR(36) PRIMARY KEY,
    ticket_number VARCHAR(24) NOT NULL UNIQUE,       -- e.g., 'HYD-2026-00412'
    org_id CHAR(36) NOT NULL,
    requester_user_id CHAR(36) NOT NULL,
    assigned_support_agent_id CHAR(36) NULL,
    module_category ENUM('AGENT','ATTENDANCE','PRODUCTIVITY','MONITORING','PROJECTS','BILLING','DLP','HR_PAYROLL','INTEGRATIONS','OTHER') NOT NULL,
    priority ENUM('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM',
    status ENUM('OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    diagnostics_bundle_s3_key VARCHAR(512) NULL,     -- Auto-captured browser + agent telemetry JSON
    sla_first_response_due_at DATETIME(3) NOT NULL,
    sla_resolution_due_at DATETIME(3) NOT NULL,
    csat_rating TINYINT UNSIGNED NULL,               -- 1..5 stars after resolution
    csat_comment TEXT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    resolved_at DATETIME(3) NULL,
    INDEX idx_tickets_org_status (org_id, status, created_at DESC)
) ENGINE=InnoDB;

CREATE TABLE support_ticket_messages (
    id CHAR(36) PRIMARY KEY,
    ticket_id CHAR(36) NOT NULL,
    sender_user_id CHAR(36) NOT NULL,
    is_internal_note TINYINT(1) NOT NULL DEFAULT 0,
    message_body TEXT NOT NULL,
    attachments_json JSON NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_ticket_msgs (ticket_id, created_at ASC)
) ENGINE=InnoDB;
```

---

## 3. Screen-by-Screen 15-Point Specifications

---

### Screen `G-001` — Global Application Shell, Sidebar, Header & 8-Dimension Filter Engine
1. **Screen ID, Title & Route**: `G-001` — Application Shell | Route: `apps/web/src/app/(authenticated)/layout.tsx`.
2. **Purpose, Target Roles & Permission**: Unified layout shell providing top header utilities, RBAC-filtered collapsible sidebar across all 15 navigation groups (`33 Modules`), and the sticky **8-Dimension Global Filter Bar** synchronized across URL query parameters and React context. Roles: All Authenticated Users. Permission: Valid Session.
3. **UI Components**:
   * **Top Header (`56px` fixed)**: Brand Logo (white-labeled via `BRAND-001`), Sidebar Collapse Toggle (`[` shortcut), Global Search Omnibar (`Cmd+K`), Multi-Organization Switcher (`ENT-002`), Global Date Range Selector (`Today`, `Yesterday`, `This Week`, `Last 7 Days`, `This Month`, `Custom`), Active Timezone Switcher (`Org TZ`, `Team TZ`, `User Local TZ`), HydiAI Copilot Button (`🤖`), Notification Bell (`NOTIF-001`), Help Menu (`HELP-001`), User Profile Dropdown.
   * **Expandable/Collapsible Left Sidebar (`260px` / `64px`)**: Renders the complete HydiEms navigation hierarchy (`Dashboard`, `Workforce`, `Time`, `Productivity`, `Monitoring`, `Work`, `Analytics`, `Reports`, `Alerts`, `HR`, `Performance`, `Field`, `Security`, `HydiAI`, `Integrations`, `Administration`), dynamically hiding any item disabled by `ENTITLE-001` or `PERM-001`.
   * **Global 8-Dimension Analytics Filter Bar**:
     1. `Date / Date Range`
     2. `Employee` (Virtualized searchable multi-select)
     3. `Department` (Multi-select)
     4. `Team` (Multi-select, cascaded from Department)
     5. `Location / Branch` (Multi-select)
     6. `Manager` (Hierarchical tree selector — filters by direct or transitive reports via `employee_reporting_closure`)
     7. `Project` (Multi-select)
     8. `Client` (Multi-select)
     * Plus `[Save Filter Preset]`, `[Load Preset]`, and `[Clear All]`.
4. **Actions**: Toggle sidebar, switch subsidiary org, apply/clear global filters, save named filter preset, switch viewing timezone, open HydiAI drawer, open Notification popover.
5. **Filters, Search, Sort & Pagination**: All 8 global filters serialize deterministically into URL query parameters (`?from=...&to=...&emp=...&dept=...&team=...&loc=...&mgr=...&proj=...&client=...&tz=...`).
6. **UI States**: Skeleton shell on initial SSR hydration; Offline WebSocket banner at top of viewport when network drops; Locked filter pills for `MANAGER` / `TEAM_LEAD` / `EMPLOYEE` roles scoped to their allowed hierarchy.
7. **Validation Rules**: Date range max span validated (`<= 366 days` for granular queries; unlimited for `ANA-010` Lifetime Heatmaps).
8. **Business Rules**:
   * **Role-Enforced Filter Locking**: An `EMPLOYEE` has `Employee = Self` locked; a `TEAM_LEAD` has `Team = Assigned Teams` locked; a `MANAGER` has `Manager Subtree = Self` locked (`employee_reporting_closure.ancestor_employee_id = currentEmployeeId`). Backend Fastify middleware independently enforces this closure join on every query regardless of query string tampering.
9. **Notifications & Audit Events**: Switching subsidiary organization (`ENT-002`) logs `session.org_context.switched` in `AUDIT-002`.
10. **API Endpoints**: `GET /api/v1/shell/bootstrap` (returns user profile, effective `PERM-001` & `PERM-002` permissions, `ENTITLE-001` flags, branding `BRAND-001`, unread notification count, and filter dropdown options), `POST /api/v1/shell/filter-presets`.
11. **Database Entities**: `organizations`, `roles`, `user_filter_presets`, `employee_reporting_closure`.
12. **Security Requirements**: Server-side enforcement of `org_id` and `employee_reporting_closure` on every filter query.
13. **Mobile/Responsive Behavior**: Sidebar converts into a swipeable off-canvas drawer on `< 1024px`; Global Filter Bar collapses into a `[Filters (N Active)]` bottom sheet on mobile.
14. **Acceptance Criteria**:
    * Selecting `Department = Engineering` and `Date = This Week` updates the URL and refreshes all charts/tables on the current page without a full page reload, and persists when navigating from `Attendance` to `Productivity`.

---

### Screen `AR` — System-Wide Reusable Right-Side Detail Drawer
1. **Screen ID, Title & Route**: `AR` — System-Wide Contextual Detail Drawer | Route: Query param `?drawer=employee|project|task|screenshot|device|incident&drawerId=:uuid`.
2. **Purpose, Target Roles & Permission**: Opens a non-disruptive `540px` slide-over drawer on the right side of any screen to inspect an Employee, Project, Task, Screenshot, Device, or Security Incident without losing the parent table/chart context.
3. **UI Components (Employee Variant)**:
   * **Header**: Avatar, Live Status Badge (`WORKING 02:32:18`, `IDLE`, `BREAK`, `OFFLINE`), Name, Employee ID, Designation, Department, Team, Line Manager.
   * **Today's Pulse Strip**: `Working (7h 21m)` | `Productive (6h 08m)` | `Idle (42m)` | `Productivity (83.4%)`.
   * **Current Live Activity Card**: Foreground App Icon + Name (`VS Code`), Window Title / URL, Active Project (`Project Alpha`), Active Task (`Backend API`), Latest Screenshot Thumbnail (`Captured 3m ago`).
   * **Mini Day Timeline (`07:00 – 19:00`)**: Interactive color-coded bar (Green/Red/Yellow/Grey).
   * **Quick Navigation Footer**: `[View Full Profile (WF-003)]`, `[View Activity (ACT-007)]`, `[View Screenshots (SS-002)]`, `[Live Screen (MON-002)]`.
4. **Actions**: Close drawer (`Esc` or outside click), copy deep link, trigger manual screenshot (`SS-006`), jump to full profile.
5. **UI States**: Shimmer skeleton while fetching `<40ms` summary, `403` card if viewer lacks permission for that specific entity.
6. **API Endpoints**: `GET /api/v1/drawer/:entityType/:entityId` (Aggregates MySQL profile + Redis live presence + ClickHouse today rollup in parallel via `Promise.all`).
7. **Acceptance Criteria**: Clicking any employee name in `ATT-001`, `PROD-002`, `MON-001`, or `WF-001` opens the `AR` drawer in `< 100ms` while keeping the underlying table scroll position intact.

---

### Screens `SEARCH-001` & `SEARCH-002` — Global Command Search (`Cmd+K`) & Advanced Search
1. **Screen IDs & Routes**: `SEARCH-001` (Modal `Cmd+K` / `Ctrl+K`) & `SEARCH-002` (`/search`).
2. **Purpose, Roles & Permission**: Federated search across **8 Entity Types**: `Employees`, `Projects`, `Tasks`, `Reports`, `Screenshots`, `Applications`, `Websites`, and `Documents`. Roles: All Authenticated Users (RBAC-scoped). Permission: `PERM_GLOBAL_SEARCH`.
3. **UI Components**:
   * `SEARCH-001`: Instant modal input with debounced (`120ms`) grouped results (Top 3 per category), keyboard shortcuts, quick navigation actions, and `[View All Results in Advanced Search ->]`.
   * `SEARCH-002`: Full-page search workspace with 8 Category Tabs (showing result counts per tab) + **7 Left-Facet Filters** (`Date Range`, `Employee`, `Department`, `Team`, `Project`, `Application`, `Website`) + highlighted snippet cards.
4. **Validation & Business Rules**: Minimum query length `2` characters; Screenshot and Website search queries ClickHouse `window_title` and `browser_url` only if the caller holds `SENSITIVE_SCREENSHOTS_VIEW` / `PERM_ACTIVITY_VIEW`.
5. **Audit Events (`AUDIT-002`)**: Searches containing sensitive terms or executed in `SEARCH-002` across other employees log `search.federated.executed`.
6. **API Endpoints**: `GET /api/v1/search/quick?q=...` & `GET /api/v1/search/advanced?q=...&category=...&from=...&to=...&emp=...&dept=...&team=...&proj=...&app=...&site=...`.
7. **Acceptance Criteria**: Searching `"jira"` returns matching Tasks, Projects, Website logs (`jira.atlassian.com`), Application usage, and Screenshots with `"Jira"` in the window title in `< 100ms`.

---

### Screens `NOTIF-001` & `NOTIF-002` — Notification Center & Notification Settings
1. **Screen IDs & Routes**: `NOTIF-001` (`/notifications` + Header Bell Popover) & `NOTIF-002` (`/settings/notifications`).
2. **Purpose, Roles & Permission**: Real-time alert inbox across 7 categories (`Attendance`, `Tasks`, `Projects`, `Approvals`, `Security`, `HR`, `AI`) and granular per-user delivery channel preferences.
3. **UI Components**:
   * `NOTIF-001`: Category filter pills (`All`, `Unread`, `Approvals`, `Attendance`, `Tasks`, `Projects`, `Security`, `HR`, `AI`), `[Mark All as Read]`, `[Archive Read]`, and Notification Cards with **1-Click Inline Approval Buttons** (`[Approve]`, `[Reject]`) for Leave/Attendance/Timesheet requests.
   * `NOTIF-002`: Toggle matrix of 7 Categories $\times$ 5 Channels (`In-App`, `Email`, `Desktop Agent Toast`, `Mobile Push`, `WhatsApp`) + **Right-to-Disconnect Quiet Hours** (`Start Time`, `End Time`, `Timezone`).
4. **Business Rules**: Security & Critical System alerts cannot be muted by users if marked `mandatory_by_org_policy = true`. During Quiet Hours, non-urgent Desktop Toast and Mobile Push notifications are held in BullMQ delayed state until `quiet_hours_end`.
5. **API Endpoints**: `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `POST /api/v1/notifications/read-all`, `GET/PUT /api/v1/notifications/preferences`.
6. **Acceptance Criteria**: When a manager approves a leave request, the employee's `NOTIF-001` bell badge increments in `< 500ms` via WebSocket without refreshing the browser.

---

### Screens `HELP-001..004` & `SUPPORT-001..006` — Help Center, Knowledge Base, Support Ticketing & System Status
1. **Screen IDs & Routes**:
   * `HELP-001`: `/help` (Help Center Home, Interactive Onboarding Checklist, Video Tutorials)
   * `HELP-002` & `SUPPORT-005`: `/help/kb` & `/help/kb/:slug` (Knowledge Base Search & Article Viewer)
   * `HELP-003` & `SUPPORT-002`: `/support/tickets/new` (Create Support Ticket)
   * `SUPPORT-001`: `/support/tickets` (Support Dashboard & SLA Tracker)
   * `SUPPORT-003`: `/support/tickets/:id` (Ticket Detail, Threaded Conversation & Diagnostic Bundle Viewer)
   * `SUPPORT-004`: `/support/tickets/history` (Closed/Resolved Ticket Archive & CSAT History)
   * `HELP-004` & `SUPPORT-006`: `/status` (Live System Status & 90-Day Uptime Bars)
2. **UI Components & Actions**:
   * `SUPPORT-001`: KPI cards (`Open Tickets`, `In Progress`, `Waiting on Customer`, `Avg First Response Time`, `CSAT Score`), filterable ticket table.
   * `SUPPORT-002`: Form with `Subject`, `Module Category`, `Priority`, Rich-Text `Description`, File Upload, and **`[x] Auto-Attach System & Agent Diagnostics`** checkbox.
   * `SUPPORT-003`: Chat-style message thread between Tenant Admin/User and HydiEms Support Engineer, SLA countdown badge, `[Resolve Ticket]`, and 5-star CSAT rating modal.
3. **Business Rules**:
   * **SLA Calculation**: `URGENT` = 1h first response / 4h resolution; `HIGH` = 4h / 12h; `MEDIUM` = 8h / 24h; `LOW` = 24h / 72h.
4. **API Endpoints**: `GET /api/v1/kb/articles`, `GET/POST /api/v1/support/tickets`, `POST /api/v1/support/tickets/:id/messages`, `PATCH /api/v1/support/tickets/:id/status`.
5. **Acceptance Criteria**: Creating a ticket in `SUPPORT-002` with diagnostics enabled automatically attaches the caller's recent API trace IDs and agent health status JSON to S3 and displays it to the support engineer in `SUPPORT-003`.
