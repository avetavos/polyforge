def _create(client, auth_headers, user_id="user-1", sku="A", qty=1):
    return client.post(
        "/orders",
        json={"items": [{"sku": sku, "qty": qty}]},
        headers=auth_headers(user_id),
    )


def test_create_order(client, auth_headers):
    resp = client.post(
        "/orders",
        json={"items": [{"sku": "ABC", "qty": 2}, {"sku": "XYZ", "qty": 1}]},
        headers=auth_headers("user-1"),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["message"] == "Order created successfully"
    data = body["data"]
    assert data["status"] == "PENDING"
    assert data["id"]
    assert data["created_at"]
    assert len(data["items"]) == 2
    assert {i["sku"] for i in data["items"]} == {"ABC", "XYZ"}


def test_list_orders_scoped_to_user(client, auth_headers):
    _create(client, auth_headers, "user-1", sku="A")
    _create(client, auth_headers, "user-2", sku="B")

    resp = client.get("/orders", headers=auth_headers("user-1"))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["items"][0]["sku"] == "A"


def test_list_orders_admin_sees_all(client, auth_headers):
    _create(client, auth_headers, "user-1", sku="A")
    _create(client, auth_headers, "user-2", sku="B")

    resp = client.get("/orders", headers=auth_headers("admin", role="administrator"))
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 2


def test_get_order_by_id(client, auth_headers):
    order_id = _create(client, auth_headers, "user-1").json()["data"]["id"]

    resp = client.get(f"/orders/{order_id}", headers=auth_headers("user-1"))
    assert resp.status_code == 200
    assert resp.json()["data"]["id"] == order_id


def test_get_order_not_found(client, auth_headers):
    resp = client.get("/orders/does-not-exist", headers=auth_headers("user-1"))
    assert resp.status_code == 404
    assert resp.json()["data"] is None


def test_get_order_other_user_is_hidden(client, auth_headers):
    order_id = _create(client, auth_headers, "user-1").json()["data"]["id"]

    resp = client.get(f"/orders/{order_id}", headers=auth_headers("user-2"))
    assert resp.status_code == 404


def test_cancel_order(client, auth_headers):
    order_id = _create(client, auth_headers, "user-1").json()["data"]["id"]

    resp = client.patch(f"/orders/{order_id}", headers=auth_headers("user-1"))
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "CANCELLED"


def test_cancel_order_twice_fails(client, auth_headers):
    order_id = _create(client, auth_headers, "user-1").json()["data"]["id"]
    client.patch(f"/orders/{order_id}", headers=auth_headers("user-1"))

    resp = client.patch(f"/orders/{order_id}", headers=auth_headers("user-1"))
    assert resp.status_code == 400
    assert resp.json()["data"] is None


def test_cancel_order_not_found(client, auth_headers):
    resp = client.patch("/orders/nope", headers=auth_headers("user-1"))
    assert resp.status_code == 400
