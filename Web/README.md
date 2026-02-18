# 🚗 בדיקת דוחות חנייה

בדיקה מרכזית ומקבילית של דוחות חנייה ב-22 רשויות מקומיות בישראל.

```
parking-app/
├── backend/               ← Python FastAPI  →  Railway
│   ├── main.py
│   ├── requirements.txt
│   ├── railway.toml
│   └── Procfile
└── frontend/              ← React + Vite    →  Vercel
    ├── src/
    │   ├── App.tsx        ← כל ה-UI
    │   ├── api.ts         ← קריאות לשרת
    │   ├── main.tsx
    │   └── index.css
    ├── index.html
    ├── vite.config.ts
    ├── vercel.json
    └── .env.example
```

---

## ⚡ הרצה מקומית (5 דקות)

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → http://localhost:8000
```

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL נשאר ריק — vite.config מפנה דרך proxy
npm run dev
# → http://localhost:3000
```

---

## ☁️ פריסה לענן: Vercel + Railway

### שלב 1 — Backend ל-Railway

1. לך ל-[railway.app](https://railway.app) → **New Project → Deploy from GitHub**
2. בחר את תיקיית `backend/`  
   (או `railway up` מה-CLI בתוך תיקיית backend)
3. Railway יזהה את `railway.toml` ויריץ `uvicorn` אוטומטית
4. **העתק את ה-URL שנוצר**, למשל:  
   `https://parking-backend-production.up.railway.app`

### שלב 2 — Frontend ל-Vercel

1. לך ל-[vercel.com](https://vercel.com) → **New Project → Import Git**
2. **Root Directory** — הגדר ל-`frontend`
3. **Environment Variables** → הוסף:
   ```
   VITE_API_URL = https://parking-backend-production.up.railway.app
   ```
4. **Build Command**: `npm run build`  
   **Output Dir**: `dist`  
   → לחץ Deploy ✅

---

## 🔌 API

| Method | Path | גוף הבקשה |
|--------|------|------------|
| `GET`  | `/`  | — |
| `GET`  | `/municipalities` | — |
| `POST` | `/check` | `{ "id_number": "...", "car_number": "..." }` |

### תגובת `/check`:
```json
{
  "results": [
    { "name": "עיריית רמת גן", "status": "clean" },
    { "name": "עיריית בית שמש", "status": "fine",
      "count": 2, "amount": "750.00",
      "fines": [{ "number": "...", "date": "01/03/2024", "amount": 250 }]
    }
  ],
  "summary": { "clean": 20, "fine": 1, "failed": 1 }
}
```

---

## 🔒 פרטיות ואבטחה

- אין שמירת ת"ז / מספר רכב בשרת
- כל בקשה עצמאית — ללא session
- הנתונים מגיעים ישירות מ-doh.co.il
- Security headers מוגדרים ב-`vercel.json`
