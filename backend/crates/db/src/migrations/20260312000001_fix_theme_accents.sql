-- Fix theme accent colors AND PrimeNG ramps: full-saturation colors were causing
-- visible color overlay on backgrounds and PrimeNG component surfaces.
-- Replace accents with subtle semi-transparent tints, and PrimeNG ramps with
-- proper gradients from light tint (50) to dark shade (950).

-- Dark themes
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,242,255,0.06)"') WHERE slug = 'cobalt';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(255,29,0,0.08)"') WHERE slug = 'crimson';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,255,0.06)"') WHERE slug = 'dimmed';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(255,0,255,0.06)"') WHERE slug = 'dracula';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,122,0.06)"') WHERE slug = 'forest';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,255,0.06)"') WHERE slug = 'github-dark';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(250,189,47,0.08)"') WHERE slug = 'gruvbox';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,0,0.06)"') WHERE slug = 'matrix';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,13,255,0.06)"') WHERE slug = 'midnight';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(255,0,230,0.06)"') WHERE slug = 'monokai';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,255,0.06)"') WHERE slug = 'nord';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,255,0.06)"') WHERE slug = 'ocean';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,255,0.06)"') WHERE slug = 'one-dark';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,255,0.06)"') WHERE slug = 'solarized-dark';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(255,255,0,0.06)"') WHERE slug = 'terminal';

-- Light themes
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(255,186,0,0.08)"') WHERE slug = 'autumn';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,235,0.06)"') WHERE slug = 'christmas';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(255,255,0,0.06)"') WHERE slug = 'cream';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,255,0.06)"') WHERE slug = 'cyan-light';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"#fff7ed"') WHERE slug = 'default';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,255,0.06)"') WHERE slug = 'emerald-light';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,255,0.06)"') WHERE slug = 'github-light';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(255,255,0,0.08)"') WHERE slug = 'halloween';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,255,0.06)"') WHERE slug = 'nord-light';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(255,218,0,0.08)"') WHERE slug = 'orange-light';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,255,0.06)"') WHERE slug = 'paper';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(255,255,0,0.06)"') WHERE slug = 'retro';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(255,0,140,0.06)"') WHERE slug = 'rose-light';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,255,0.06)"') WHERE slug = 'sky-light';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,242,255,0.06)"') WHERE slug = 'snow';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,255,0.06)"') WHERE slug = 'solarized-light';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(0,255,235,0.06)"') WHERE slug = 'spring';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(255,255,0,0.06)"') WHERE slug = 'stone';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(255,255,0,0.06)"') WHERE slug = 'summer';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(255,0,255,0.06)"') WHERE slug = 'valentine';
UPDATE themes SET colors = jsonb_set(colors::jsonb, '{accent}', '"rgba(235,0,255,0.06)"') WHERE slug = 'violet-light';

-- Fix PrimeNG ramps: replace full-saturation neon colors with proper gradients

-- Indigo-based
UPDATE themes SET primeng_ramp = '{"50":"#eef2ff","150":"#e0e7ff","250":"#c7d2fe","350":"#a5b4fc","450":"#818cf8","550":"#6366f1","650":"#4f46e5","750":"#4338ca","850":"#3730a3","950":"#312e81"}'::jsonb WHERE slug IN ('default','midnight');

-- Blue-based
UPDATE themes SET primeng_ramp = '{"50":"#eff6ff","150":"#dbeafe","250":"#bfdbfe","350":"#93c5fd","450":"#60a5fa","550":"#3b82f6","650":"#2563eb","750":"#1d4ed8","850":"#1e40af","950":"#1e3a8a"}'::jsonb WHERE slug IN ('github-light','github-dark','dimmed','nord','nord-light','one-dark','solarized-dark','solarized-light');

-- Cyan-based
UPDATE themes SET primeng_ramp = '{"50":"#ecfeff","150":"#cffafe","250":"#a5f3fc","350":"#67e8f9","450":"#22d3ee","550":"#06b6d4","650":"#0891b2","750":"#0e7490","850":"#155e75","950":"#164e63"}'::jsonb WHERE slug IN ('cobalt','snow','cyan-light','ocean','sky-light','paper');

-- Green-based
UPDATE themes SET primeng_ramp = '{"50":"#ecfdf5","150":"#d1fae5","250":"#a7f3d0","350":"#6ee7b7","450":"#34d399","550":"#10b981","650":"#059669","750":"#047857","850":"#065f46","950":"#064e3b"}'::jsonb WHERE slug IN ('emerald-light','forest','matrix','spring');

-- Orange-based
UPDATE themes SET primeng_ramp = '{"50":"#fff7ed","150":"#ffedd5","250":"#fed7aa","350":"#fdba74","450":"#fb923c","550":"#f97316","650":"#ea580c","750":"#c2410c","850":"#9a3412","950":"#7c2d12"}'::jsonb WHERE slug IN ('autumn','orange-light','halloween');

-- Yellow-based
UPDATE themes SET primeng_ramp = '{"50":"#fefce8","150":"#fef9c3","250":"#fef08a","350":"#fde047","450":"#facc15","550":"#eab308","650":"#ca8a04","750":"#a16207","850":"#854d0e","950":"#422006"}'::jsonb WHERE slug IN ('gruvbox','cream','retro','stone','summer','terminal');

-- Rose/red-based
UPDATE themes SET primeng_ramp = '{"50":"#fff1f2","150":"#ffe4e6","250":"#fecdd3","350":"#fda4af","450":"#fb7185","550":"#f43f5e","650":"#e11d48","750":"#be123c","850":"#9f1239","950":"#881337"}'::jsonb WHERE slug IN ('crimson','rose-light','christmas');

-- Purple/violet-based
UPDATE themes SET primeng_ramp = '{"50":"#faf5ff","150":"#f3e8ff","250":"#e9d5ff","350":"#d8b4fe","450":"#c084fc","550":"#a855f7","650":"#9333ea","750":"#7e22ce","850":"#6b21a8","950":"#581c87"}'::jsonb WHERE slug IN ('dracula','monokai','valentine','violet-light');
