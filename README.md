# SiagaBencana

Sistem Informasi Siaga Bencana Banjir — Kecamatan Baureno, Kabupaten Bojonegoro.

## Struktur Proyek

```
SiagaBencana/
├── backend/                # FastAPI Backend
│   ├── app/
│   │   ├── core/           # Konfigurasi, database, keamanan
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic schemas (request/response)
│   │   ├── routers/        # API route handlers
│   │   ├── services/       # Business logic & external API
│   │   └── utils/          # Helper/utility functions
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/               # React + Vite Frontend
│   ├── public/
│   ├── src/
│   │   ├── assets/         # Gambar, ikon, font
│   │   ├── components/     # Reusable UI components
│   │   │   ├── common/     # Button, Modal, Loading, dll
│   │   │   ├── map/        # Komponen peta (Leaflet)
│   │   │   ├── dashboard/  # Widget gauge, status card
│   │   │   ├── sos/        # Form & tiket SOS
│   │   │   ├── auth/       # Form login/register
│   │   │   └── admin/      # Komponen admin panel
│   │   ├── pages/          # Halaman utama (route-level)
│   │   │   ├── warga/      # Dashboard, SOS, Peta warga
│   │   │   └── admin/      # Dashboard admin, manajemen
│   │   ├── services/       # API call functions (axios)
│   │   ├── context/        # React Context (Auth, Theme)
│   │   ├── hooks/          # Custom hooks
│   │   ├── styles/         # Global CSS
│   │   └── utils/          # Helper functions
│   ├── package.json
│   └── vite.config.js
│
└── .gitignore
```

## Tech Stack

| Layer    | Teknologi                        |
|----------|----------------------------------|
| Backend  | Python, FastAPI, SQLAlchemy      |
| Frontend | React, Vite, Leaflet.js         |
| Database | MySQL                            |
| Realtime | WebSocket                        |
| API Ext  | Open-Meteo, OSRM                |