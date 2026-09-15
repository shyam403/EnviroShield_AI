CREATE TABLE public.hazard_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  risk text NOT NULL CHECK (risk IN ('red','yellow','green')),
  reason text,
  polygon jsonb NOT NULL,
  source text NOT NULL DEFAULT 'State Disaster Management Authority',
  reported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hazard_zones TO anon, authenticated;
GRANT ALL ON public.hazard_zones TO service_role;
ALTER TABLE public.hazard_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hazard zones are public" ON public.hazard_zones FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.shelters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('shelter','hospital','police','relief','safe_zone')),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  capacity integer,
  occupancy integer,
  is_open boolean NOT NULL DEFAULT true,
  contact text,
  source text NOT NULL DEFAULT 'District Emergency Operations Centre',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shelters TO anon, authenticated;
GRANT ALL ON public.shelters TO service_role;
ALTER TABLE public.shelters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shelters are public" ON public.shelters FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.flood_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','watch','warning','severe')),
  area text,
  water_level_m double precision,
  source text NOT NULL DEFAULT 'Central Water Commission',
  issued_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.flood_alerts TO anon, authenticated;
GRANT ALL ON public.flood_alerts TO service_role;
ALTER TABLE public.flood_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Flood alerts are public" ON public.flood_alerts FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.road_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  road_name text NOT NULL,
  reason text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  passable boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'Municipal Corporation',
  reported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.road_closures TO anon, authenticated;
GRANT ALL ON public.road_closures TO service_role;
ALTER TABLE public.road_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Road closures are public" ON public.road_closures FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.hazard_zones (name, risk, reason, polygon, source) VALUES
('Nadi Ghat Riverbank', 'red', 'Water level above danger mark; bank overtopped', '[[20.302,85.786],[20.318,85.800],[20.312,85.812],[20.298,85.798]]', 'State Disaster Management Authority'),
('Old Market Low Ground', 'red', 'Standing water 1.2 m, drainage backflow', '[[20.318,85.802],[20.330,85.812],[20.326,85.822],[20.314,85.814]]', 'Municipal Corporation'),
('Canal Colony', 'yellow', 'Rising canal level, may flood within 12 hours', '[[20.326,85.788],[20.340,85.800],[20.336,85.810],[20.322,85.800]]', 'State Disaster Management Authority'),
('South Drain Corridor', 'yellow', 'Overflow risk during heavy rainfall', '[[20.304,85.812],[20.318,85.824],[20.312,85.834],[20.300,85.824]]', 'Municipal Corporation'),
('Hill View Plateau', 'green', 'Elevated ground, designated evacuation zone', '[[20.336,85.822],[20.354,85.834],[20.350,85.852],[20.332,85.842]]', 'District Emergency Operations Centre'),
('Ridge Road Heights', 'green', 'High ground with all-weather access road', '[[20.322,85.836],[20.336,85.846],[20.330,85.858],[20.316,85.848]]', 'District Emergency Operations Centre');

INSERT INTO public.shelters (name, kind, lat, lng, capacity, occupancy, is_open, contact) VALUES
('Hill View Government High School Shelter', 'shelter', 20.3440, 85.8340, 800, 410, true, '1077'),
('Ridge Road Community Centre', 'shelter', 20.3280, 85.8450, 450, 445, true, '1077'),
('Plateau Stadium Evacuation Centre', 'shelter', 20.3480, 85.8420, 1500, 260, true, '1070'),
('Old Market Municipal Hall', 'shelter', 20.3200, 85.8120, 300, 300, false, '1077'),
('District General Hospital', 'hospital', 20.3360, 85.8300, NULL, NULL, true, '108'),
('Plateau Trauma Centre', 'hospital', 20.3460, 85.8480, NULL, NULL, true, '108'),
('Ridge Road Police Station', 'police', 20.3300, 85.8400, NULL, NULL, true, '100'),
('Canal Colony Police Outpost', 'police', 20.3320, 85.7980, NULL, NULL, true, '100'),
('Hill View Relief Distribution Point', 'relief', 20.3400, 85.8380, NULL, NULL, true, '1077'),
('South Ward Relief Camp', 'relief', 20.3120, 85.8280, NULL, NULL, true, '1077');

INSERT INTO public.flood_alerts (title, message, severity, area, water_level_m, source) VALUES
('Severe flood warning - Nadi river', 'River is 0.9 m above the danger mark and still rising. Residents of riverbank wards must evacuate to higher ground immediately.', 'severe', 'Nadi Ghat, Old Market', 8.7, 'Central Water Commission'),
('Heavy rainfall warning', 'Very heavy rainfall expected for the next 24 hours. Expect rapid water rise in low-lying wards.', 'warning', 'Whole district', NULL, 'Meteorological Department'),
('Canal level watch', 'Canal running near full capacity. Canal Colony residents should prepare to move.', 'watch', 'Canal Colony', 4.2, 'Irrigation Department');

INSERT INTO public.road_closures (road_name, reason, lat, lng, passable, source) VALUES
('Nadi Ghat Bridge', 'Bridge submerged, structurally unsafe', 20.3100, 85.8000, false, 'Municipal Corporation'),
('Market Link Road', 'Water depth over 1 m', 20.3220, 85.8140, false, 'Municipal Corporation'),
('Canal Side Road', 'Partially flooded, passable on foot only', 20.3300, 85.7980, true, 'Municipal Corporation'),
('South Drain Crossing', 'Culvert washed out', 20.3080, 85.8220, false, 'Municipal Corporation');