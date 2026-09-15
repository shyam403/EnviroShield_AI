ALTER TABLE public.sensor_telemetry
  ADD COLUMN IF NOT EXISTS temperature double precision,
  ADD COLUMN IF NOT EXISTS thermal_intensity double precision,
  ADD COLUMN IF NOT EXISTS fire_detected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fire_confidence double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS fire_risk text,
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'AUTO';

CREATE INDEX IF NOT EXISTS sensor_telemetry_fire_detected_idx
  ON public.sensor_telemetry (fire_detected);

CREATE INDEX IF NOT EXISTS sensor_telemetry_fire_risk_idx
  ON public.sensor_telemetry (fire_risk);
