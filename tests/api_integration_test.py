"""
NHI-Connect API integration tests (test level: Integration).

Runs against a live backend seeded with the demo dataset (Flyway V1-V5 + demo accounts) and checks every
public endpoint, role rule and audit side effect. Each test case is traced to a requirement ID from the
Design Phase traceability matrix.

Usage:  python tests/api_integration_test.py [base_url] [results.json]
        (default base_url http://localhost:8080). Use a fresh/test database: the tests create data.
Only the Python standard library is used.
"""
import json
import sys
import time
import urllib.error
import urllib.request
import uuid

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
OUT = sys.argv[2] if len(sys.argv) > 2 else "api-test-results.json"

DEMO = {  # name, ID number, expected timeline entries (from the Demo Patient Dataset)
    "Bongani Mahlangu": ("8801015800083", 9),
    "Naledi Mokoena": ("9509185412089", 1),
    "Thandeka Zulu": ("7203150460080", 7),
    "Pieter van der Berg": ("5811305129087", 6),
    "Lerato Molefe": ("0106220785088", 6),
    "Sipho Ndlovu": ("1509055401086", 5),
}

results = []


def call(method, path, token=None, body=None, raw=None, content_type=None):
    headers = {"Accept": "application/json"}
    data = None
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if raw is not None:
        data, headers["Content-Type"] = raw, content_type
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            payload = r.read()
            return r.status, payload, dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def js(payload):
    try:
        return json.loads(payload) if payload else None
    except ValueError:
        return None


def multipart(field_file, filename, content, ctype, description=None):
    boundary = "----nhi" + uuid.uuid4().hex
    parts = []
    if description is not None:
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\n{description}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{field_file}"; filename="{filename}"\r\n'
                 f'Content-Type: {ctype}\r\n\r\n'.encode() + content + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), "multipart/form-data; boundary=" + boundary


def login(username, password, role):
    status, payload, _ = call("POST", "/security/api/v1/auth/login", body={"username": username, "password": password, "role": role})
    return status, js(payload)


def tc(tc_id, req, description, expected):
    """Decorator: runs the test immediately and records the outcome."""
    def wrap(fn):
        started = time.perf_counter()
        try:
            actual = fn()
            passed, note = True, actual
        except AssertionError as e:
            passed, note = False, f"ASSERTION FAILED: {e}"
        except Exception as e:  # noqa: BLE001 - record unexpected errors as failures
            passed, note = False, f"ERROR: {type(e).__name__}: {e}"
        results.append({"id": tc_id, "req": req, "description": description, "expected": expected,
                        "actual": note, "result": "Pass" if passed else "Fail",
                        "ms": round((time.perf_counter() - started) * 1000)})
        print(f"[{'PASS' if passed else 'FAIL'}] {tc_id} ({req}) {description} -> {note}")
        return fn
    return wrap


S = {}  # shared state between test cases

# ---------------------------------------------------------------- Security layer: authentication


@tc("IT-01", "REQ-012 / Security", "Request without a token is rejected", "401 Unauthorized")
def _():
    s, _, _ = call("GET", "/engine/api/v1/patients/search?idNumber=8801015800083")
    assert s == 401, s
    return f"HTTP {s}"


@tc("IT-02", "REQ-012 / Security", "Sign-in with a wrong password is rejected", "401, generic error message")
def _():
    s, body = login("admin", "wrong-password", "ADMIN")
    assert s == 401, s
    assert "Incorrect username or password" in body["message"], body
    return f"HTTP {s}: {body['message']}"


@tc("IT-03", "REQ-012 / Security", "Each demo account signs in and receives its role", "200 + token; roles ADMIN, CLINIC, CLINICIAN")
def _():
    out = []
    for key, (u, p, choice, role) in {"admin": ("admin", "Admin@123", "ADMIN", "ADMIN"),
                                       "clinic": ("braamfontein.clinic", "Clinic@123", "CLINICIAN", "CLINIC"),
                                       "clin": ("t.moloi", "Clinician@123", "CLINICIAN", "CLINICIAN"),
                                       "clin2": ("a.khumalo", "Clinician@123", "CLINICIAN", "CLINICIAN")}.items():
        s, body = login(u, p, choice)
        assert s == 200 and body["user"]["role"] == role, (u, s, body)
        S[key] = body["token"]
        S[key + "_user"] = body["user"]
        out.append(f"{u}={role}")
    assert len(S["admin"]) == 64, "token should be 256-bit hex"
    return "; ".join(out)


@tc("IT-04", "REQ-012 / Security", "Correct password but wrong 'Sign in as' option is refused", "401 with guidance; no session")
def _():
    s, body = login("t.moloi", "Clinician@123", "ADMIN")
    assert s == 401 and "can't sign in as Administrator" in body["message"], (s, body)
    s2, _ = login("admin", "Admin@123", "CLINICIAN")
    assert s2 == 401, s2
    return f"HTTP {s} / {s2}: {body['message']}"


@tc("IT-05", "Security", "A forged token is rejected", "401")
def _():
    s, _, _ = call("GET", "/security/api/v1/auth/me", token="0" * 64)
    assert s == 401, s
    return f"HTTP {s}"

# ---------------------------------------------------------------- REQ-003 / REQ-007: unified record


@tc("IT-06", "REQ-003", "Search by ID resolves all six demo patients", "200 with the correct name for each ID")
def _():
    S["pid"] = {}
    for name, (idn, _) in DEMO.items():
        s, p, _ = call("GET", f"/engine/api/v1/patients/search?idNumber={idn}", S["clin"])
        body = js(p)
        assert s == 200 and body["fullName"] == name, (idn, s, body)
        S["pid"][name] = body["patientId"]
    return "6/6 resolved"


@tc("IT-07", "REQ-003", "Unified record returns every entry in the dataset", "Entry counts 9/1/7/6/6/5 (34 total)")
def _():
    counts = {}
    for name, (_, expected) in DEMO.items():
        s, p, _ = call("GET", f"/engine/api/v1/patients/{S['pid'][name]}/record", S["clin"])
        rec = js(p)
        assert s == 200, s
        counts[name] = len(rec["timeline"])
        assert counts[name] == expected, (name, counts[name], expected)
    return f"{sum(counts.values())}/34 entries: " + ", ".join(f"{k.split()[0]} {v}" for k, v in counts.items())


@tc("IT-08", "REQ-003", "Cross-facility record spans hospitals and provinces", "Bongani: 3 facilities, 3 provinces")
def _():
    s, p, _ = call("GET", f"/engine/api/v1/patients/{S['pid']['Bongani Mahlangu']}/record", S["clin"])
    rec = js(p)
    assert rec["facilityCount"] == 3 and sorted(rec["provinces"]) == ["Gauteng", "KwaZulu-Natal", "Western Cape"], rec
    return f"{rec['facilityCount']} facilities; {', '.join(rec['provinces'])}"


@tc("IT-09", "REQ-003", "Timeline is in chronological order", "Each entry date >= previous")
def _():
    checked = 0
    for name in DEMO:
        rec = js(call("GET", f"/engine/api/v1/patients/{S['pid'][name]}/record", S["clin"])[1])
        dates = [t["date"] for t in rec["timeline"]]
        from datetime import datetime
        parsed = [datetime.fromisoformat(d.replace("Z", "+00:00")) for d in dates]
        assert parsed == sorted(parsed), (name, dates)
        checked += len(parsed)
    return f"{checked} entries in order"


@tc("IT-10", "REQ-007", "Completeness notice and per-facility sync time are returned", "Notice present; lastSyncedAt on every entry")
def _():
    rec = js(call("GET", f"/engine/api/v1/patients/{S['pid']['Bongani Mahlangu']}/record", S["clin"])[1])
    assert "Not all facilities" in rec["completenessNotice"]
    assert all(t["facilityLastSyncedAt"] for t in rec["timeline"])
    return "notice present; 9/9 entries carry facilityLastSyncedAt"


@tc("IT-11", "REQ-003", "Unknown ID number returns not-found", "404 + audit event FLAGGED")
def _():
    s, p, _ = call("GET", "/engine/api/v1/patients/search?idNumber=0000000000000", S["clin"])
    assert s == 404, s
    return f"HTTP {s}: {js(p)['message']}"


@tc("IT-12", "REQ-003 / Security", "Malformed and injection-style ID numbers are rejected", "400, never 500")
def _():
    out = []
    for bad in ["12345", "88010158000A3", "%27%20OR%201%3D1--"]:
        s, _, _ = call("GET", f"/engine/api/v1/patients/search?idNumber={bad}", S["clin"])
        assert s == 400, (bad, s)
        out.append(str(s))
    s, body = login("admin' OR '1'='1", "x' OR '1'='1", "ADMIN")
    assert s == 401, s
    return f"search: {'/'.join(out)}; SQL-injection login: HTTP {s}"

# ---------------------------------------------------------------- RBAC


@tc("IT-13", "REQ-012 / Security", "Role-based access control on every portal API", "403 for every cross-role call")
def _():
    pid = S["pid"]["Naledi Mokoena"]
    checks = [("CLINICIAN->admin", "GET", "/engine/api/v1/admin/overview", S["clin"]),
              ("CLINICIAN->clinic", "GET", "/engine/api/v1/clinic/overview", S["clin"]),
              ("CLINIC->admin", "GET", "/engine/api/v1/admin/users", S["clinic"]),
              ("ADMIN->record", "GET", f"/engine/api/v1/patients/{pid}/record", S["admin"]),
              ("ADMIN->search", "GET", "/engine/api/v1/patients/search?idNumber=8801015800083", S["admin"]),
              ("ADMIN->add entry", "POST", f"/engine/api/v1/patients/{pid}/entries", S["admin"])]
    for label, m, path, tok in checks:
        s, _, _ = call(m, path, tok, body={"type": "LAB", "date": "2026-01-01", "title": "x"} if m == "POST" else None)
        assert s == 403, (label, s)
    return f"{len(checks)}/{len(checks)} cross-role calls returned 403"

# ---------------------------------------------------------------- REQ-002: manual intake (clinic portal)


@tc("IT-14", "REQ-002", "Clinic adds a patient who is not on the national record", "Created and linked to the clinic")
def _():
    s, p, _ = call("POST", "/engine/api/v1/clinic/patients", S["clinic"], body={
        "nationalId": "9001015009087", "firstName": "Thabo", "surname": "Test-Nkosi",
        "dateOfBirth": "1990-01-01", "sex": "Male", "localPatientId": "BGH-TEST-001"})
    body = js(p)
    assert s == 200 and body["alreadyOnNationalRecord"] is False, (s, body)
    S["new_pid"] = body["patient"]["patientId"]
    listed = js(call("GET", "/engine/api/v1/clinic/patients", S["clinic"])[1])
    assert any(x["patientId"] == S["new_pid"] for x in listed)
    return f"created {body['patient']['fullName']}, file no. {body['patient']['localPatientId']}"


@tc("IT-15", "REQ-002", "Date of birth that contradicts the ID number is rejected", "400 with explanation")
def _():
    s, p, _ = call("POST", "/engine/api/v1/clinic/patients", S["clinic"], body={
        "nationalId": "9202025009081", "firstName": "A", "surname": "B", "dateOfBirth": "1993-02-02", "sex": "Male"})
    assert s == 400 and "doesn't match the ID number" in js(p)["message"], (s, p)
    return f"HTTP {s}"


@tc("IT-16", "REQ-002 / REQ-003", "Adding an existing ID number links instead of duplicating", "alreadyOnNationalRecord = true; no new patient")
def _():
    before = js(call("GET", "/engine/api/v1/admin/overview", S["admin"])[1])["stats"]["patients"]
    s, p, _ = call("POST", "/engine/api/v1/clinic/patients", S["clinic"], body={
        "nationalId": "7203150460080", "firstName": "Thandeka", "surname": "Zulu", "dateOfBirth": "1972-03-15", "sex": "Female"})
    after = js(call("GET", "/engine/api/v1/admin/overview", S["admin"])[1])["stats"]["patients"]
    assert s == 200 and js(p)["alreadyOnNationalRecord"] is True and before == after, (s, before, after)
    return f"linked; patient count unchanged ({before})"


@tc("IT-17", "REQ-002 / REQ-003", "Clinic-entered visit, lab and medication appear to a clinician at another hospital", "3 new entries visible to Umhlanga clinician")
def _():
    for e in [{"type": "ENCOUNTER", "date": "2026-11-02", "encounterType": "OUTPATIENT", "title": "Manual intake visit", "detail": "Paper record captured"},
              {"type": "LAB", "date": "2026-11-02", "title": "Random glucose", "detail": "5.4 mmol/L"},
              {"type": "MEDICATION", "date": "2026-11-02", "title": "Metformin 500mg", "detail": "Twice daily"}]:
        s, p, _ = call("POST", f"/engine/api/v1/patients/{S['new_pid']}/entries", S["clinic"], body=e)
        assert s == 200 and js(p)["sentForReview"] is False, (s, p)
    rec = js(call("GET", f"/engine/api/v1/patients/{S['new_pid']}/record", S["clin2"])[1])
    titles = [t["title"] for t in rec["timeline"]]
    assert titles == ["Manual intake visit", "Random glucose", "Metformin 500mg"], titles
    return f"Umhlanga clinician sees {len(titles)} entries in order: {titles}"


@tc("IT-30", "REQ-007", "A manual entry refreshes its facility's last-synced time", "lastSyncedAt on the new entries is within the last 5 minutes")
def _():
    from datetime import datetime, timezone
    rec = js(call("GET", f"/engine/api/v1/patients/{S['new_pid']}/record", S["clin"])[1])
    synced = datetime.fromisoformat(rec["timeline"][-1]["facilityLastSyncedAt"].replace("Z", "+00:00"))
    age = (datetime.now(timezone.utc) - synced).total_seconds()
    assert age < 300, f"last synced {synced.isoformat()} ({age:.0f}s ago)"
    return f"facility last synced {age:.0f}s before the check"


@tc("IT-18", "REQ-002", "Future-dated and untitled entries are rejected", "400")
def _():
    s1, _, _ = call("POST", f"/engine/api/v1/patients/{S['new_pid']}/entries", S["clinic"], body={"type": "LAB", "date": "2099-01-01", "title": "x"})
    s2, _, _ = call("POST", f"/engine/api/v1/patients/{S['new_pid']}/entries", S["clinic"], body={"type": "LAB", "date": "2026-01-01", "title": ""})
    s3, _, _ = call("POST", f"/engine/api/v1/patients/{S['new_pid']}/entries", S["clinic"], body={"type": "XRAY", "date": "2026-01-01", "title": "x"})
    assert (s1, s2, s3) == (400, 400, 400), (s1, s2, s3)
    return "future date 400; blank title 400; unknown type 400"


@tc("IT-19", "REQ-002", "PDF upload is stored and returned byte-for-byte", "201; download identical; DOCUMENT_VIEW audited")
def _():
    pdf = b"%PDF-1.4\n% NHI-Connect test lab report\n" + bytes(range(256)) * 40 + b"\n%%EOF\n"
    body, ct = multipart("file", "NHLS report.pdf", pdf, "application/pdf", "Lab report")
    s, p, _ = call("POST", f"/engine/api/v1/patients/{S['new_pid']}/documents", S["clinic"], raw=body, content_type=ct)
    assert s == 201, (s, p)
    doc = js(p)
    s2, data, headers = call("GET", f"/engine/api/v1/documents/{doc['id']}", S["clin2"])
    assert s2 == 200 and data == pdf, (s2, len(data), len(pdf))
    assert headers.get("X-Content-Type-Options") == "nosniff"
    return f"{len(pdf)} bytes stored and downloaded identically; nosniff header set"


@tc("IT-20", "REQ-002 / Security", "Disallowed and oversized uploads are rejected", "400 for .exe; 413 for >10 MB")
def _():
    body, ct = multipart("file", "virus.exe", b"MZ\x90\x00", "application/x-msdownload")
    s1, _, _ = call("POST", f"/engine/api/v1/patients/{S['new_pid']}/documents", S["clinic"], raw=body, content_type=ct)
    body, ct = multipart("file", "big.pdf", b"0" * (11 * 1024 * 1024), "application/pdf")
    s2, _, _ = call("POST", f"/engine/api/v1/patients/{S['new_pid']}/documents", S["clinic"], raw=body, content_type=ct)
    assert s1 == 400 and s2 == 413, (s1, s2)
    return f".exe HTTP {s1}; 11 MB HTTP {s2}"

# ---------------------------------------------------------------- clinician updates sent for review


@tc("IT-21", "REQ-002 (scope extension)", "Clinician's blood result is saved and sent to their clinic and the admin", "sentForReview; clinic inbox pending; admin sees it")
def _():
    pid = S["pid"]["Naledi Mokoena"]
    s, p, _ = call("POST", f"/engine/api/v1/patients/{pid}/entries", S["clin"], body={
        "type": "LAB", "date": "2026-11-05", "title": "Full Blood Count", "detail": "Hb 13.2 g/dL - normal"})
    assert s == 200 and js(p)["sentForReview"] is True, (s, p)
    inbox = js(call("GET", "/engine/api/v1/clinic/updates", S["clinic"])[1])
    mine = [u for u in inbox if u["summary"].endswith("Full Blood Count") and u["reviewedAt"] is None]
    assert mine, inbox
    S["update_id"] = mine[0]["id"]
    admin = js(call("GET", "/engine/api/v1/admin/updates", S["admin"])[1])
    assert any(u["id"] == S["update_id"] for u in admin)
    return f"pending in Braamfontein inbox (sent by {mine[0]['submittedBy']}); visible to admin"


@tc("IT-22", "Security", "A clinic cannot review another clinic's update", "404 for foreign update; own update 204")
def _():
    pid = S["pid"]["Thandeka Zulu"]
    call("POST", f"/engine/api/v1/patients/{pid}/entries", S["clin2"], body={"type": "LAB", "date": "2026-11-05", "title": "Viral load", "detail": "<50 copies/mL"})
    foreign = [u for u in js(call("GET", "/engine/api/v1/admin/updates", S["admin"])[1]) if u["facilityName"].startswith("Umhlanga")][0]
    s1, _, _ = call("POST", f"/engine/api/v1/clinic/updates/{foreign['id']}/review", S["clinic"])
    s2, _, _ = call("POST", f"/engine/api/v1/clinic/updates/{S['update_id']}/review", S["clinic"])
    reviewed = [u for u in js(call("GET", "/engine/api/v1/clinic/updates", S["clinic"])[1]) if u["id"] == S["update_id"]][0]
    assert (s1, s2) == (404, 204) and reviewed["reviewedBy"], (s1, s2, reviewed)
    return f"foreign HTTP {s1}; own HTTP {s2}; reviewed by {reviewed['reviewedBy']}"

# ---------------------------------------------------------------- REQ-012: account management


@tc("IT-23", "REQ-012", "Admin onboards a clinic and creates its staff sign-in", "Clinic + account created; new user signs in to an empty clinic")
def _():
    s, p, _ = call("POST", "/engine/api/v1/admin/facilities", S["admin"], body={"name": "Khayelitsha Test Clinic", "province": "Western Cape"})
    assert s == 201, (s, p)
    S["fac"] = js(p)["id"]
    s, p, _ = call("POST", "/engine/api/v1/admin/users", S["admin"], body={
        "username": "kh.clinic", "fullName": "Khayelitsha Records", "password": "StartPass2026", "role": "CLINIC", "facilityId": S["fac"]})
    assert s == 201, (s, p)
    S["new_user"] = js(p)["id"]
    s, body = login("kh.clinic", "StartPass2026", "CLINICIAN")
    assert s == 200 and body["user"]["facilityName"] == "Khayelitsha Test Clinic", (s, body)
    S["kh"] = body["token"]
    pts = js(call("GET", "/engine/api/v1/clinic/patients", S["kh"])[1])
    assert pts == [], pts
    return "clinic created; kh.clinic signs in; sees 0 patients (no other clinic's data)"


@tc("IT-24", "REQ-012", "Account-creation input validation", "409 duplicate username/clinic; 400 short password; 400 missing clinic")
def _():
    s1, _, _ = call("POST", "/engine/api/v1/admin/users", S["admin"], body={"username": "KH.Clinic", "fullName": "Dup", "password": "LongEnough1", "role": "CLINIC", "facilityId": S["fac"]})
    s2, _, _ = call("POST", "/engine/api/v1/admin/users", S["admin"], body={"username": "short.pw", "fullName": "X", "password": "abc", "role": "CLINICIAN", "facilityId": S["fac"]})
    s3, _, _ = call("POST", "/engine/api/v1/admin/users", S["admin"], body={"username": "no.fac", "fullName": "X", "password": "LongEnough1", "role": "CLINICIAN"})
    s4, _, _ = call("POST", "/engine/api/v1/admin/facilities", S["admin"], body={"name": "khayelitsha test clinic", "province": "Western Cape"})
    assert (s1, s2, s3, s4) == (409, 400, 400, 409), (s1, s2, s3, s4)
    return f"{s1}/{s2}/{s3}/{s4}"


@tc("IT-25", "REQ-012 / Security", "Disabling an account ends its sessions immediately", "Live token 401; sign-in refused")
def _():
    s, _, _ = call("PATCH", f"/engine/api/v1/admin/users/{S['new_user']}", S["admin"], body={"active": False})
    s2, _, _ = call("GET", "/engine/api/v1/clinic/overview", S["kh"])
    s3, _ = login("kh.clinic", "StartPass2026", "CLINICIAN")
    s4, _, _ = call("PATCH", f"/engine/api/v1/admin/users/{S['admin_user']['id']}", S["admin"], body={"active": False})
    assert (s, s2, s3, s4) == (200, 401, 401, 400), (s, s2, s3, s4)
    return f"disable {s}; old token {s2}; re-login {s3}; admin self-disable blocked {s4}"


@tc("IT-26", "REQ-012", "Password reset replaces the password and signs the user out", "Old password 401, new password 200")
def _():
    call("PATCH", f"/engine/api/v1/admin/users/{S['new_user']}", S["admin"], body={"active": True})
    s, _, _ = call("POST", f"/engine/api/v1/admin/users/{S['new_user']}/password", S["admin"], body={"password": "NewPass2026!"})
    s1, _ = login("kh.clinic", "StartPass2026", "CLINICIAN")
    s2, _ = login("kh.clinic", "NewPass2026!", "CLINICIAN")
    assert (s, s1, s2) == (204, 401, 200), (s, s1, s2)
    return f"reset {s}; old {s1}; new {s2}"


@tc("IT-27", "Security", "Sign-out revokes the token", "Token valid before, 401 after")
def _():
    s0, _, _ = call("GET", "/security/api/v1/auth/me", S["clin2"])
    s1, _, _ = call("POST", "/security/api/v1/auth/logout", S["clin2"])
    s2, _, _ = call("GET", "/security/api/v1/auth/me", S["clin2"])
    assert (s0, s1, s2) == (200, 204, 401), (s0, s1, s2)
    return f"before {s0}; logout {s1}; after {s2}"

# ---------------------------------------------------------------- audit trail (Security layer / Objective 5)


@tc("IT-28", "Security (Objective 5)", "Every access and change is in the audit log with user, clinic and patient", "Expected event types present with correct attribution")
def _():
    log = js(call("GET", "/engine/api/v1/admin/audit?limit=1000", S["admin"])[1])
    kinds = {(e["eventType"], e["outcome"]) for e in log}
    needed = {("LOGIN", "SUCCESS"), ("LOGIN", "FAILED"), ("PATIENT_SEARCH", "SUCCESS"), ("PATIENT_SEARCH", "FLAGGED"),
              ("RECORD_VIEW", "SUCCESS"), ("PATIENT_CREATED", "SUCCESS"), ("PATIENT_LINKED", "SUCCESS"),
              ("ENTRY_ADDED", "SUCCESS"), ("DOCUMENT_UPLOADED", "SUCCESS"), ("DOCUMENT_VIEW", "SUCCESS"),
              ("UPDATE_REVIEWED", "SUCCESS"), ("CLINIC_CREATED", "SUCCESS"), ("USER_CREATED", "SUCCESS"),
              ("USER_DISABLED", "SUCCESS"), ("PASSWORD_RESET", "SUCCESS"), ("LOGOUT", "SUCCESS")}
    missing = needed - kinds
    assert not missing, missing
    view = next(e for e in log if e["eventType"] == "RECORD_VIEW" and e["username"] == "t.moloi")
    assert view["facilityName"] == "Braamfontein General Hospital" and view["patientName"], view
    S["audit_events"] = len(log)
    return f"{len(needed)}/{len(needed)} event types logged ({len(log)} events); e.g. {view['fullName']} @ {view['facilityName']} viewed {view['patientName']}"


@tc("IT-29", "Security", "Admin overview reports live sessions and failed sign-ins", "Signed-in users listed; failed sign-ins counted")
def _():
    o = js(call("GET", "/engine/api/v1/admin/overview", S["admin"])[1])
    users = {a["username"] for a in o["activeSessions"]}
    names = [a["username"] for a in o["activeSessions"]]
    assert {"admin", "t.moloi", "braamfontein.clinic"} <= users and o["stats"]["failedSignInsToday"] >= 3, o
    assert len(names) == len(set(names)), f"a person is listed more than once: {names}"
    assert "a.khumalo" not in users, "signed-out user still listed"
    return f"signed in (one row per person): {sorted(users)}; signed-out a.khumalo absent; failed sign-ins today: {o['stats']['failedSignInsToday']}"


passed = sum(r["result"] == "Pass" for r in results)
print(f"\n{passed}/{len(results)} passed")
with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"base": BASE, "ranAt": time.strftime("%Y-%m-%d %H:%M:%S"), "passed": passed, "total": len(results), "cases": results}, f, indent=2)
sys.exit(0 if passed == len(results) else 1)
