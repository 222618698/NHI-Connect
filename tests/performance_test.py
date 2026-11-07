"""
NHI-Connect response-time measurement (evaluation evidence for Objective 2 / REQ-003).

Measures, against a running local backend:
  * sign-in latency (includes BCrypt password hashing, cost factor 10)
  * patient search by ID latency
  * unified-record retrieval latency, sequentially and under concurrent load
Usage: python tests/performance_test.py [base_url] [results.json]
"""
import json
import os
import statistics
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
OUT = sys.argv[2] if len(sys.argv) > 2 else "performance-results.json"
CLINICIAN_PW = os.environ.get("NHI_DEMO_CLINICIAN_PASSWORD", "").strip() or sys.exit(
    "Set NHI_DEMO_CLINICIAN_PASSWORD to the demo clinician password the backend was started with.")
IDS = ["8801015800083", "9509185412089", "7203150460080", "5811305129087", "0106220785088", "1509055401086"]


def req(path, token=None, body=None):
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = None
    if body is not None:
        data, headers["Content-Type"] = json.dumps(body).encode(), "application/json"
    r = urllib.request.Request(BASE + path, data=data, headers=headers, method="POST" if data else "GET")
    t = time.perf_counter()
    with urllib.request.urlopen(r, timeout=30) as resp:
        payload = resp.read()
    return (time.perf_counter() - t) * 1000, json.loads(payload)


def summary(samples):
    s = sorted(samples)
    pct = lambda p: s[min(len(s) - 1, round(p / 100 * (len(s) - 1)))]
    return {"n": len(s), "mean": round(statistics.mean(s), 1), "p50": round(pct(50), 1),
            "p95": round(pct(95), 1), "max": round(max(s), 1), "min": round(min(s), 1)}


def login():
    return req("/security/api/v1/auth/login", body={"username": "t.moloi", "password": CLINICIAN_PW, "role": "CLINICIAN"})


# warm-up so JIT compilation and connection pools don't distort the first samples
_, first = login()
token = first["token"]
pids = {}
for i in IDS:
    _, p = req(f"/engine/api/v1/patients/search?idNumber={i}", token)
    pids[i] = p["patientId"]
for _ in range(30):
    for pid in pids.values():
        req(f"/engine/api/v1/patients/{pid}/record", token)

results = {}
results["login"] = summary([login()[0] for _ in range(30)])
results["search"] = summary([req(f"/engine/api/v1/patients/search?idNumber={IDS[k % 6]}", token)[0] for k in range(300)])
results["record"] = summary([req(f"/engine/api/v1/patients/{pids[IDS[k % 6]]}/record", token)[0] for k in range(300)])

# concurrent load: 20 parallel clients, 25 record retrievals each (500 requests)
CLIENTS, PER = 20, 25
def client(n):
    return [req(f"/engine/api/v1/patients/{pids[IDS[(n + k) % 6]]}/record", token)[0] for k in range(PER)]
start = time.perf_counter()
with ThreadPoolExecutor(max_workers=CLIENTS) as pool:
    samples = [x for chunk in pool.map(client, range(CLIENTS)) for x in chunk]
elapsed = time.perf_counter() - start
results["record_concurrent"] = summary(samples) | {"clients": CLIENTS, "throughput_rps": round(len(samples) / elapsed, 1)}

for k, v in results.items():
    print(f"{k:18} {v}")
with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"base": BASE, "ranAt": time.strftime("%Y-%m-%d %H:%M:%S"), "results": results}, f, indent=2)
