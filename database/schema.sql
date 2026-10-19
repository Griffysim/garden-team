CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('supervisor','employee','owner')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  has_vegetable_garden BOOLEAN NOT NULL DEFAULT FALSE,
  has_accommodation BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  property_id INT REFERENCES properties(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','blocked','review','done')),
  category TEXT NOT NULL DEFAULT 'general',
  proof_note TEXT DEFAULT '',
  completion_note TEXT DEFAULT '',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES users(id),
  recipient_id UUID REFERENCES users(id),
  property_id INT REFERENCES properties(id) ON DELETE SET NULL,
  subject TEXT DEFAULT '',
  body TEXT NOT NULL,
  is_announcement BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS message_reads (
  message_id BIGINT REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(message_id,user_id)
);
CREATE TABLE IF NOT EXISTS onboarding_items (
  id SERIAL PRIMARY KEY,
  phase INT NOT NULL CHECK (phase IN (30,60,90)),
  sort_order INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  employee_status TEXT NOT NULL DEFAULT 'not_started' CHECK (employee_status IN ('not_started','learning','ready_for_review','signed_off','needs_practice')),
  employee_note TEXT DEFAULT '',
  supervisor_note TEXT DEFAULT '',
  signed_by UUID REFERENCES users(id),
  signed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS daily_logs (
  id BIGSERIAL PRIMARY KEY,
  log_date DATE NOT NULL,
  property_id INT NOT NULL REFERENCES properties(id),
  user_id UUID NOT NULL REFERENCES users(id),
  weather TEXT DEFAULT '',
  priorities TEXT DEFAULT '',
  work_completed TEXT NOT NULL,
  problems TEXT DEFAULT '',
  next_actions TEXT DEFAULT '',
  hours_worked NUMERIC(4,1),
  supervisor_feedback TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(log_date,property_id,user_id)
);
CREATE TABLE IF NOT EXISTS vegetable_records (
  id BIGSERIAL PRIMARY KEY,
  property_id INT NOT NULL REFERENCES properties(id),
  bed_name TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('planting','watering','feeding','pest','harvest','rotation')),
  record_date DATE NOT NULL,
  crop TEXT DEFAULT '',
  variety TEXT DEFAULT '',
  quantity TEXT DEFAULT '',
  details TEXT DEFAULT '',
  next_action_date DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS equipment (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  equipment_type TEXT NOT NULL,
  property_id INT REFERENCES properties(id),
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('good','attention','do_not_use','service_due')),
  authorised_users UUID[] DEFAULT '{}',
  service_due DATE,
  notes TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS equipment_logs (
  id BIGSERIAL PRIMARY KEY,
  equipment_id INT NOT NULL REFERENCES equipment(id),
  user_id UUID NOT NULL REFERENCES users(id),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  precheck_passed BOOLEAN NOT NULL DEFAULT FALSE,
  hours_used NUMERIC(4,1),
  fuel_used TEXT DEFAULT '',
  fault TEXT DEFAULT '',
  action_taken TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS accommodation_notes (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general','house_rule','maintenance','inspection','request')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  created_by UUID NOT NULL REFERENCES users(id),
  visible_to_employee BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS progress_reviews (
  id BIGSERIAL PRIMARY KEY,
  review_date DATE NOT NULL,
  phase INT CHECK (phase IN (30,60,90)),
  safety INT CHECK (safety BETWEEN 1 AND 5),
  time_management INT CHECK (time_management BETWEEN 1 AND 5),
  quality INT CHECK (quality BETWEEN 1 AND 5),
  equipment_care INT CHECK (equipment_care BETWEEN 1 AND 5),
  vegetable_management INT CHECK (vegetable_management BETWEEN 1 AND 5),
  communication INT CHECK (communication BETWEEN 1 AND 5),
  strengths TEXT DEFAULT '',
  improvement TEXT DEFAULT '',
  goals TEXT DEFAULT '',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users(name,email,password_hash,role) VALUES
('Simon','simon@example.com',crypt('ChangeMe-Simon-2026!',gen_salt('bf',10)),'supervisor'),
('Msesa','msesa@example.com',crypt('ChangeMe-Msesa-2026!',gen_salt('bf',10)),'employee'),
('Karen','karen@example.com',crypt('ChangeMe-Karen-2026!',gen_salt('bf',10)),'owner')
ON CONFLICT(email) DO NOTHING;

INSERT INTO properties(name,description,has_vegetable_garden,has_accommodation) VALUES
('The Farm','Large property with vegetable garden',TRUE,FALSE),
('Rocky Bank','Large property with vegetable garden and Msesa accommodation',TRUE,TRUE),
('Wargrave','Large garden property',FALSE,FALSE)
ON CONFLICT(name) DO NOTHING;

INSERT INTO equipment(name,equipment_type,notes) VALUES
('Kudu Mower','mower','Authorisation required before use'),
('Ride-on Mower','ride_on','Exact model training and zone approval required'),
('Brushcutter','brushcutter','15 metre exclusion zone; PPE required')
ON CONFLICT DO NOTHING;

INSERT INTO onboarding_items(phase,sort_order,title,description,category) VALUES
(30,1,'Property orientation','Learn all zones, water points, hazards, access and storage at The Farm, Rocky Bank and Wargrave.','orientation'),
(30,2,'Safety and PPE','Wear correct PPE and apply the stop-work rule without reminders.','safety'),
(30,3,'Hand tools','Use, clean, count and store normal hand tools correctly.','equipment'),
(30,4,'Watering and irrigation','Check soil first, water correctly and report leaks.','garden'),
(30,5,'Kudu mower training','Complete theory, supervised practice and machine-specific sign-off.','equipment'),
(30,6,'Brushcutter training','Complete PPE, danger-zone and supervised practical training.','equipment'),
(30,7,'Basic records','Complete daily logs, machine logs and vegetable records with help.','records'),
(60,1,'Complete full work zones','Plan, complete, inspect and record normal zones with limited supervision.','management'),
(60,2,'Vegetable garden routine','Manage weekly inspection, planting, weeding, harvesting and records.','vegetables'),
(60,3,'Ride-on mower training','Complete exact-machine theory and three supervised practical sessions.','equipment'),
(60,4,'Weekly planning','Draft a realistic weekly plan with materials and backup tasks.','management'),
(60,5,'First improvement project','Complete and document one visible property improvement.','progress'),
(60,6,'Equipment responsibility','Perform checks, cleaning, logs and early fault reporting.','equipment'),
(90,1,'Independent property days','Manage a full approved workday at each property.','management'),
(90,2,'Manage normal week','Plan and deliver the normal workload across all three properties.','management'),
(90,3,'Vegetable production plan','Prepare a four-to-eight-week planting and harvest plan.','vegetables'),
(90,4,'Stock and service planning','Identify stock and service needs before they become urgent.','equipment'),
(90,5,'Second improvement project','Complete a second visible, recorded property improvement.','progress'),
(90,6,'Final competency review','Demonstrate safety, quality, records, reporting and self-management.','review')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date,status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(log_date DESC);
CREATE INDEX IF NOT EXISTS idx_vegetable_property_date ON vegetable_records(property_id,record_date DESC);
