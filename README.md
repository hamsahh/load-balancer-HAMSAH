# Smart Gateway Load Balancer 3 Server

## Judul Project
**Simulasi Smart Gateway Load Balancing Tiga Server Berbasis Docker dengan Monitoring Real-Time**

Project ini adalah simulasi load balancing menggunakan **3 backend server** yang berjalan di dalam Docker. Load balancer mendukung dua algoritma, yaitu **Round Robin** dan **Least Connection**, serta memiliki dashboard web untuk melihat distribusi request secara real-time.

## Fitur Utama

- 3 backend server: `server-a`, `server-b`, dan `server-c`
- Load balancer berbasis Node.js dan Express
- Algoritma Round Robin
- Algoritma Least Connection
- Dashboard monitoring real-time menggunakan WebSocket
- Pengujian request manual dan batch melalui browser
- Script pengujian terminal menggunakan Python
- Docker Compose untuk menjalankan semua service sekaligus

## Struktur Folder

```text
smart-gateway-load-balancer-3server/
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── gateway/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── public/
│       └── index.html
├── scripts/
│   └── test_load.py
├── hasil-pengujian/
│   └── contoh_hasil.txt
├── laporan/
│   └── LAPORAN_SMART_GATEWAY_HAMSAH.md
├── tangkapan-layar/
│   └── .gitkeep
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Cara Menjalankan di VS Code

Buka terminal di folder project, lalu jalankan:

```bash
docker compose up --build
```

Setelah semua container aktif, buka browser:

```text
http://localhost:3000
```

## Cara Menghentikan Project

Tekan `Ctrl + C`, lalu jalankan:

```bash
docker compose down
```

## Cara Pengujian dari Browser

1. Buka `http://localhost:3000`.
2. Pilih algoritma **Round Robin** atau **Least Connection**.
3. Klik **Kirim 1 Request** untuk mengirim satu request.
4. Isi jumlah request, lalu klik **Kirim Batch** untuk pengujian banyak request.
5. Lihat distribusi request pada kartu server dan log aktivitas.

## Cara Pengujian dari Terminal

Pastikan Docker sudah berjalan, lalu buka terminal baru di folder project.

### Uji Round Robin

```bash
python scripts/test_load.py --algorithm round-robin --requests 30 --workers 10
```

### Uji Least Connection

```bash
python scripts/test_load.py --algorithm least-connection --requests 30 --workers 10
```

## Endpoint API

| Endpoint | Method | Fungsi |
|---|---|---|
| `/` | GET | Dashboard web |
| `/api/work` | GET | Mengirim 1 request ke backend melalui load balancer |
| `/api/stats` | GET | Melihat status server dan statistik request |
| `/api/algorithm` | POST | Mengubah algoritma load balancing |
| `/api/test` | POST | Mengirim request batch untuk pengujian |

Contoh mengganti algoritma:

```bash
curl -X POST http://localhost:3000/api/algorithm \
  -H "Content-Type: application/json" \
  -d '{"algorithm":"least-connection"}'
```

## Penjelasan Singkat Algoritma

### Round Robin

Round Robin membagi request secara bergiliran ke server-a, server-b, dan server-c. Polanya mudah diprediksi dan cocok untuk server dengan kemampuan yang relatif sama.

### Least Connection

Least Connection memilih server dengan jumlah koneksi aktif paling sedikit. Algoritma ini lebih adaptif ketika tiap request memiliki waktu proses yang berbeda.

## Perintah Upload ke GitHub

Ganti `USERNAME` dengan username GitHub Anda.

```bash
git init
git add .
git commit -m "project load balancer 3 server"
git branch -M main
git remote add origin https://github.com/USERNAME/smart-gateway-load-balancer-3server.git
git push -u origin main
```
