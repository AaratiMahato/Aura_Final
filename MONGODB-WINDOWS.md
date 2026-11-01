# MongoDB on Windows (Compass is only the viewer)

MongoDB Compass shows your data, but the database itself is **MongoDB Community Server**. Without it, Compass says "You have not connected to any deployments" and the app shows error 500.

## 1. Install the server
1. https://www.mongodb.com/try/download/community -> Platform: Windows, Package: MSI -> Download.
2. Run the installer -> **Complete**. Keep **"Install MongoDB as a Service"** ticked (Run as Network Service).
3. Finish. It starts automatically.

Check it is running (PowerShell):
```powershell
Test-NetConnection 127.0.0.1 -Port 27017
```
`TcpTestSucceeded : True` means it works. If False: press Win+R, type `services.msc`, find **MongoDB Server**, right-click -> Start.

## 2. Connect Compass
Compass -> **Add new connection** -> URI: `mongodb://127.0.0.1:27017` -> **Connect**.

## 3. Use it with the app
`server\.env` should contain:
```
MONGODB_URI=mongodb://127.0.0.1:27017/aura_pro
```
Run `.\start.bat`. The terminal must show `[DB] MongoDB connected`.
Register in the app, then in Compass click the refresh icon: database **aura_pro** -> collection **users** holds every account. Posts are saved in **posts**.

## Session
Login lasts 3 minutes of inactivity (change `SESSION_MINUTES` in `server\.env`). While you click or type, it stays alive. After 3 idle minutes you are signed out and sign in again with the same email and password (or Facebook).

## Using Atlas instead (no install)
Use the Atlas string in `MONGODB_URI` (see KEYS-GUIDE.md).
