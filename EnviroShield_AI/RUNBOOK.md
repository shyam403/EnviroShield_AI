# EnviroShield Live Pipeline Runbook

This is the exact command set for the verified Renode → Zephyr UART → serial bridge → backend → SQLite/Supabase → app pipeline.

## 1) Start Renode

```powershell
Set-Location 'C:\Users\mogal\zephyrproject\enviroshield'; & 'C:\Program Files\Renode\renode.exe' 'C:\Users\mogal\zephyrproject\enviroshield\enviroshield.resc'
```

## 2) Start the serial bridge

```powershell
Set-Location 'C:\Users\mogal\zephyrproject\enviroshield'; python serial_bridge.py
```

## 3) Start the backend

```powershell
Set-Location 'C:\Users\mogal\zephyrproject\enviroshield\backend'; node server.js
```

## 4) Start the app

```powershell
Set-Location 'C:\envirosheild\EnviroShield_AI\EnviroShield_AI'; npx vite
```

## 5) Run the Android app

```powershell
Set-Location 'C:\envirosheild\EnviroShield_AI\EnviroShield_AI'; npx cap run android
```

## 6) Trigger a live forest fire test in Renode

```powershell
Set-Location 'C:\Users\mogal\zephyrproject\enviroshield'; python -c "import socket, time; s=socket.create_connection(('127.0.0.1',12345),timeout=3); print('connected'); time.sleep(2); s.sendall(b'CMD:SCENARIO:FOREST_FIRE\n'); time.sleep(2); print('sent'); s.close()"
```

## 7) Verify the backend is receiving telemetry

```powershell
Set-Location 'C:\Users\mogal\zephyrproject\enviroshield\backend'; node -e "const http=require('http'); const url='http://127.0.0.1:3001/api/telemetry/latest'; http.get(url,res=>{let d=''; res.on('data',c=>d+=c); res.on('end',()=>{console.log('STATUS',res.statusCode); console.log(d.slice(0,500));});}).on('error',e=>{console.error('ERR',e.message); process.exit(1);});"
```

## 8) Check local SQLite fire records

```powershell
Set-Location 'C:\Users\mogal\zephyrproject\enviroshield\backend'; node -e "const sqlite3=require('sqlite3').verbose(); const db=new sqlite3.Database('local_store.db'); db.all('SELECT * FROM forest_fire_telemetry ORDER BY id DESC LIMIT 5', function(err, rows){ if(err){ console.error(err); process.exit(1); } console.log(JSON.stringify(rows,null,2)); db.close(); });"
```

## 9) Regression test for risk logic

```powershell
Set-Location 'C:\envirosheild\EnviroShield_AI\EnviroShield_AI'; node --test src/lib/telemetry-risk.test.ts
```

## Expected live values

The verified CRITICAL fire payload is:

- Temperature: 82°C
- Thermal Intensity: 94%
- Fire Confidence: 97%
- Fire Risk: CRITICAL
- Coordinates: 16.9891, 82.2475

The pipeline should show these values live in the app and in the backend/local DB after the Renode fire scenario is triggered.

## Notes

- Supabase is optional in this environment; if credentials are missing, the backend falls back to local SQLite without breaking the pipeline.
- If Renode is not started first, the bridge will retry until it connects.
- No redesign or broader changes were required.
