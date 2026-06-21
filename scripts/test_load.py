#!/usr/bin/env python3
"""
Script pengujian load balancer tiga server.
Contoh:
  python scripts/test_load.py --algorithm round-robin --requests 30 --workers 10
  python scripts/test_load.py --algorithm least-connection --requests 30 --workers 10
"""

import argparse
import json
import statistics
import time
import urllib.error
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed


def request_json(url, method="GET", payload=None, timeout=10):
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def normalize_algorithm(value):
    value = value.lower().strip()
    aliases = {
        "rr": "round-robin",
        "roundrobin": "round-robin",
        "round-robin": "round-robin",
        "lc": "least-connection",
        "leastconnection": "least-connection",
        "least-connection": "least-connection",
    }
    if value not in aliases:
        raise ValueError("Algoritma harus round-robin/rr atau least-connection/lc")
    return aliases[value]


def send_one(base_url, index):
    started_at = time.perf_counter()
    result = request_json(f"{base_url}/api/work")
    elapsed_ms = round((time.perf_counter() - started_at) * 1000, 2)
    return {
        "index": index,
        "target": result["gateway"]["targetId"],
        "target_name": result["gateway"]["targetName"],
        "latency_ms": elapsed_ms,
        "backend_ms": result["backend"].get("processingTimeMs"),
        "algorithm": result["gateway"]["algorithm"],
    }


def main():
    parser = argparse.ArgumentParser(description="Uji distribusi request pada Smart Gateway Load Balancer.")
    parser.add_argument("--url", default="http://localhost:3000", help="URL load balancer. Default: http://localhost:3000")
    parser.add_argument("--algorithm", default="round-robin", help="round-robin/rr atau least-connection/lc")
    parser.add_argument("--requests", type=int, default=30, help="Jumlah request yang dikirim")
    parser.add_argument("--workers", type=int, default=10, help="Jumlah worker paralel")
    args = parser.parse_args()

    base_url = args.url.rstrip("/")
    algorithm = normalize_algorithm(args.algorithm)

    print("=== MULAI PENGUJIAN LOAD BALANCER 3 SERVER ===")
    print(f"URL        : {base_url}")
    print(f"Algoritma  : {algorithm}")
    print(f"Request    : {args.requests}")
    print(f"Workers    : {args.workers}")
    print("-" * 56)

    request_json(f"{base_url}/api/algorithm", method="POST", payload={"algorithm": algorithm})

    results = []
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(send_one, base_url, i + 1) for i in range(args.requests)]
        for future in as_completed(futures):
            try:
                item = future.result()
                results.append(item)
                print(
                    f"Request {item['index']:02d} -> {item['target']} "
                    f"| latency {item['latency_ms']} ms | backend {item['backend_ms']} ms"
                )
            except (urllib.error.URLError, urllib.error.HTTPError, KeyError, TimeoutError) as exc:
                print(f"Request gagal: {exc}")

    print("-" * 56)
    if not results:
        print("Tidak ada request yang berhasil.")
        return

    distribution = Counter(item["target"] for item in results)
    latencies = [item["latency_ms"] for item in results]

    print("Distribusi request:")
    for server, count in sorted(distribution.items()):
        percentage = (count / len(results)) * 100
        print(f"  {server}: {count} request ({percentage:.2f}%)")

    print("Ringkasan latency:")
    print(f"  Rata-rata : {statistics.mean(latencies):.2f} ms")
    print(f"  Minimum   : {min(latencies):.2f} ms")
    print(f"  Maksimum   : {max(latencies):.2f} ms")
    print("=== SELESAI ===")


if __name__ == "__main__":
    main()
