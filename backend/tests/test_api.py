def _upload(client, data, filename="sample_cv.pdf"):
    return client.post("/api/imports", files={"file": (filename, data, "application/pdf")})


def _import_sample(client, sample_pdf):
    response = _upload(client, sample_pdf)
    assert response.status_code == 201
    return response.json()


def test_import_pdf_stores_roles_and_bullets(client, sample_pdf):
    imported = _import_sample(client, sample_pdf)
    assert imported["header"].startswith("Alex Rivera")
    assert imported["filename"] == "sample_cv.pdf"

    cv = client.get("/api/cv").json()
    roles = cv["roles"]
    assert len(roles) == 7
    assert sum(len(r["bullets"]) for r in roles) == 13
    assert [r["company"] for r in roles[:3]] == [
        "Paper Lantern Labs",
        "Brightline Consulting",
        "Open Data Lab",
    ]
    bullet = roles[1]["bullets"][0]
    assert bullet["subheading"] == "Healthcare client"
    assert bullet["version"] == 1

    versions = client.get(f"/api/bullets/{bullet['id']}/versions").json()
    assert [(v["version"], v["source"]) for v in versions] == [(1, "import")]


def test_times_are_sent_as_utc(client, sample_pdf):
    # Without a timezone, browsers read the time as local and show it hours off.
    bullet = _import_sample(client, sample_pdf)["roles"][0]["bullets"][0]
    (version,) = client.get(f"/api/bullets/{bullet['id']}/versions").json()
    assert version["created_at"].endswith("Z")


def test_cv_is_404_before_import(client):
    assert client.get("/api/cv").status_code == 404


def test_second_import_is_refused(client, sample_pdf):
    _import_sample(client, sample_pdf)
    assert _upload(client, sample_pdf).status_code == 409
    assert len(client.get("/api/cv").json()["roles"]) == 7


def test_non_pdf_upload_is_rejected(client):
    assert _upload(client, b"just some text", "cv.txt").status_code == 422
    assert _upload(client, b"", "empty.pdf").status_code == 422
    assert _upload(client, b"%PDF-1.4 broken", "broken.pdf").status_code == 422
    assert client.get("/api/cv").status_code == 404


def test_editing_a_bullet_keeps_history(client, sample_pdf):
    bullet = _import_sample(client, sample_pdf)["roles"][0]["bullets"][0]
    original = bullet["text"]

    response = client.patch(f"/api/bullets/{bullet['id']}", json={"text": "Shipped inkwell"})
    assert response.status_code == 200
    assert response.json()["version"] == 2

    # Re-saving the same text is not a new version.
    client.patch(f"/api/bullets/{bullet['id']}", json={"text": "Shipped inkwell"})
    versions = client.get(f"/api/bullets/{bullet['id']}/versions").json()
    assert [(v["version"], v["text"], v["source"]) for v in versions] == [
        (1, original, "import"),
        (2, "Shipped inkwell", "edit"),
    ]


def test_tags_are_cleaned_and_replace_the_old_list(client, sample_pdf):
    bullet = _import_sample(client, sample_pdf)["roles"][0]["bullets"][0]
    url = f"/api/bullets/{bullet['id']}"

    response = client.patch(url, json={"tags": [" typescript ", "", "testing", "typescript"]})
    assert response.json()["tags"] == ["typescript", "testing"]
    assert response.json()["version"] == 1

    assert client.patch(url, json={"tags": ["react"]}).json()["tags"] == ["react"]
    # Leaving tags out keeps them.
    assert client.patch(url, json={"text": "Shipped inkwell"}).json()["tags"] == ["react"]


def test_editing_a_role(client, sample_pdf):
    role = _import_sample(client, sample_pdf)["roles"][0]
    response = client.patch(
        f"/api/roles/{role['id']}",
        json={"title": "Founder", "end_date": "Present", "section": "Work"},
    )
    assert response.status_code == 200
    saved = client.get(f"/api/roles/{role['id']}").json()
    assert (saved["title"], saved["end_date"], saved["section"]) == ("Founder", "Present", "Work")
    assert saved["company"] == role["company"]
    assert saved["heading"] == role["heading"]


def test_role_without_heading_keeps_its_section(client, sample_pdf):
    skills = _import_sample(client, sample_pdf)["roles"][-1]
    assert skills["heading"] is None
    url = f"/api/roles/{skills['id']}"
    assert client.patch(url, json={"section": "Experience"}).status_code == 422
    # Sending the same section is fine.
    assert client.patch(url, json={"section": "Skills"}).status_code == 200
    assert client.get(url).json()["section"] == "Skills"


def test_section_cannot_be_cleared(client, sample_pdf):
    role = _import_sample(client, sample_pdf)["roles"][0]
    url = f"/api/roles/{role['id']}"
    assert client.patch(url, json={"section": None}).status_code == 422
    assert client.patch(url, json={"section": ""}).status_code == 422
    assert client.get(url).json()["section"] == "Experience"


def test_missing_objects_return_404(client):
    assert client.get("/api/roles/999").status_code == 404
    assert client.patch("/api/roles/999", json={"title": "x"}).status_code == 404
    assert client.patch("/api/bullets/999", json={"text": "x"}).status_code == 404
    assert client.get("/api/bullets/999/versions").status_code == 404
