-- lftcrwd schema for the Spacefast Space database (MariaDB 11.8).
-- Converted from the Supabase/Postgres schema (pg_dump 2026-10-20).
--
-- Conventions
--   ids        CHAR(36) UUID strings, same values as on Supabase so imported rows keep their links
--   times      DATETIME(3), always UTC (the app writes UTC; Postgres timestamptz did the same)
--   json       JSON (MariaDB stores it as LONGTEXT with a validity check)
--   ownership  Postgres row-level security is gone; every query in the app filters by user_id.
--
-- Run once in the Space's db console (sf db console → SQL), in this order.

CREATE TABLE users (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  email       VARCHAR(320) NOT NULL,
  name        VARCHAR(200) NULL,
  google_sub  VARCHAR(64)  NULL,
  is_admin    BOOLEAN      NOT NULL DEFAULT FALSE,
  archived    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_login_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_key (email),
  UNIQUE KEY users_google_sub_key (google_sub)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trainer_settings (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  business_name VARCHAR(200) NOT NULL DEFAULT 'lftcrwd Fitness',
  tagline       TEXT         NULL,
  updated_at    DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE client_profiles (
  user_id    CHAR(36)    NOT NULL,
  category   VARCHAR(64) NOT NULL DEFAULT 'recomposition',
  created_at DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT client_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE client_meal_plans (
  id            CHAR(36)    NOT NULL DEFAULT (UUID()),
  user_id       CHAR(36)    NOT NULL,
  content       MEDIUMTEXT  NOT NULL,
  user_plan     MEDIUMTEXT  NULL,
  active_source VARCHAR(32) NOT NULL DEFAULT 'trainer',
  created_at    DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY client_meal_plans_user_id_key (user_id),
  CONSTRAINT client_meal_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE client_workout_plans (
  id            CHAR(36)    NOT NULL DEFAULT (UUID()),
  user_id       CHAR(36)    NOT NULL,
  content       MEDIUMTEXT  NOT NULL,
  user_plan     MEDIUMTEXT  NULL,
  active_source VARCHAR(32) NOT NULL DEFAULT 'trainer',
  created_at    DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY client_workout_plans_user_id_key (user_id),
  CONSTRAINT client_workout_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE daily_logs (
  id                CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id           CHAR(36)     NOT NULL,
  date              DATE         NOT NULL,
  protein_g         INT          NULL DEFAULT 0,
  water_oz          INT          NULL DEFAULT 0,
  creatine          BOOLEAN      NULL DEFAULT FALSE,
  cardio_done       BOOLEAN      NULL DEFAULT FALSE,
  cardio_minutes    INT          NULL DEFAULT 0,
  cardio_type       VARCHAR(64)  NULL,
  cardio_details    JSON         NULL,
  steps             INT          NULL DEFAULT 0,
  weight_lbs        DECIMAL(7,2) NULL,
  cheat_meal_used   BOOLEAN      NULL DEFAULT FALSE,
  meal_1_done       BOOLEAN      NULL DEFAULT FALSE,
  meal_2_done       BOOLEAN      NULL DEFAULT FALSE,
  meal_3_done       BOOLEAN      NULL DEFAULT FALSE,
  meal_4_done       BOOLEAN      NULL DEFAULT FALSE,
  meal_5_done       BOOLEAN      NULL DEFAULT FALSE,
  custom_meals_done JSON         NULL DEFAULT ('{}'),
  created_at        DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY daily_logs_date_user_key (date, user_id),
  KEY daily_logs_user_date (user_id, date),
  CONSTRAINT daily_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workout_sessions (
  id         CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id    CHAR(36)     NOT NULL,
  date       DATE         NOT NULL DEFAULT (CURRENT_DATE),
  day_number INT          NOT NULL,
  day_name   VARCHAR(200) NOT NULL,
  completed  BOOLEAN      NULL DEFAULT FALSE,
  notes      TEXT         NULL,
  created_at DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY workout_sessions_user_date (user_id, date),
  CONSTRAINT workout_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE exercise_logs (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id       CHAR(36)     NOT NULL,
  session_id    CHAR(36)     NULL,
  exercise_name VARCHAR(200) NOT NULL,
  set_number    INT          NOT NULL,
  weight_lbs    DECIMAL(7,2) NULL,
  reps          INT          NULL,
  rest_seconds  INT          NULL,
  created_at    DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY exercise_logs_user (user_id, created_at),
  KEY exercise_logs_session (session_id),
  CONSTRAINT exercise_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES workout_sessions (id) ON DELETE CASCADE,
  CONSTRAINT exercise_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE meal_calorie_targets (
  id         CHAR(36)    NOT NULL DEFAULT (UUID()),
  user_id    CHAR(36)    NOT NULL,
  meal_index INT         NOT NULL,
  calories   INT         NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY meal_calorie_targets_user_id_meal_index_key (user_id, meal_index),
  CONSTRAINT meal_calorie_targets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
  id         CHAR(36)    NOT NULL DEFAULT (UUID()),
  user_id    CHAR(36)    NOT NULL,
  body       TEXT        NOT NULL,
  sender     VARCHAR(16) NOT NULL,
  created_at DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY messages_user_created (user_id, created_at),
  CONSTRAINT messages_sender_check CHECK (sender IN ('user', 'trainer')),
  CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE weekly_checkins (
  id         CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id    CHAR(36)     NOT NULL,
  week_start DATE         NOT NULL,
  weight_lbs DECIMAL(5,1) NULL,
  energy     INT          NULL,
  sleep_hrs  DECIMAL(3,1) NULL,
  adherence  INT          NULL,
  stress     INT          NULL,
  mood       INT          NULL,
  recovery   INT          NULL,
  notes      TEXT         NULL,
  created_at DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY weekly_checkins_user_id_week_start_key (user_id, week_start),
  CONSTRAINT weekly_checkins_energy_check    CHECK (energy    BETWEEN 1 AND 5),
  CONSTRAINT weekly_checkins_adherence_check CHECK (adherence BETWEEN 1 AND 5),
  CONSTRAINT weekly_checkins_stress_check    CHECK (stress    BETWEEN 1 AND 5),
  CONSTRAINT weekly_checkins_mood_check      CHECK (mood      BETWEEN 1 AND 5),
  CONSTRAINT weekly_checkins_recovery_check  CHECK (recovery  BETWEEN 1 AND 5),
  CONSTRAINT weekly_checkins_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Progress photos: replaces the Supabase "progress-photos" bucket path scheme
-- (<user_id>/<date>-<ms>.<ext>). Files live in Space storage; this maps them to owners.
CREATE TABLE progress_photos (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id     CHAR(36)     NOT NULL,
  storage_key VARCHAR(255) NOT NULL,
  taken_on    DATE         NULL,
  mime_type   VARCHAR(64)  NULL,
  bytes       INT          NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY progress_photos_storage_key (storage_key),
  KEY progress_photos_user (user_id, created_at),
  CONSTRAINT progress_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
