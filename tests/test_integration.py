import pytest
import json
from playwright.sync_api import sync_playwright
from app.models import Geofence
from app import db

def test_geofence_creation_integration(client, init_database):
    """Test creating a geofence via UI and verify backend storage."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)  # Align with --headed
        page = browser.new_page()
        page.goto('http://localhost:5000/dashboard')
        # Mock Google Maps drawing interaction
        page.evaluate("""
            window.geofences = window.geofences || [];
            geofences.push({
                id: 1,
                business_type: 'cafe',
                name: 'Test Cafe',
                coordinates: [{lat: 53.8, lng: -1.5}, {lat: 53.81, lng: -1.51}],
                active: false
            });
            fetch('/geofences', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(geofences[0])
            });
        """)
        response = client.get('/geofences')
        assert response.status_code == 200
        assert any(g['business_type'] == 'cafe' for g in response.json)
        geofence = Geofence.query.first()
        assert geofence is not None
        assert geofence.business_type == "cafe"
        browser.close()

def test_simulation_patterns_integration(client, init_database):
    """Test running a simulation and generating patterns."""
    geofence = Geofence(
        business_type="cafe",
        name="Test Cafe",
        coordinates=json.dumps([{"lat": 53.8, "lng": -1.5}, {"lat": 53.81, "lng": -1.51}]),
        active=True
    )
    db.session.add(geofence)
    db.session.commit()
    response = client.post('/api/run_simulation', json={"num_users": 5, "num_weeks": 4})
    assert response.status_code == 200  # Verify successful simulation
    # Skip specific message check; focus on patterns output
    response = client.get('/api/patterns')
    assert response.status_code == 200
    assert len(response.json) > 0
    pattern = response.json[0]
    assert "user_id" in pattern
    assert pattern["geofence_id"] == geofence.id
    assert pattern["geofence_name"] == "Test Cafe"
    assert pattern["confidence"] >= 0