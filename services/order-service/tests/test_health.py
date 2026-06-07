def test_healthz_ok(client):
    resp = client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["service"] == "UP"
    assert body["database"] == "UP"
