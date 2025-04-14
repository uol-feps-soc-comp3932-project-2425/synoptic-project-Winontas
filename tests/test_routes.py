import pytest
import json
from datetime import datetime
from app.models import Geofence, Tracking
from app import db

def test_create_geofence(client, init_database):
    """Test POST /geofences creates a geofence."""
    # Clear database to ensure isolation
    Geofence.query.delete()
    db.session.commit()
    
    data = {
        "business_type": "cafe",
        "name": "Test Cafe",
        "coordinates": [{"lat": 53.8, "lng": -1.5}, {"lat": 53.81, "lng": -1.51}],
        "active": False
    }
    response = client.post('/geofences', json=data)
    assert response.status_code == 201
    assert response.json["message"] == "Geofence created"
    geofence = Geofence.query.first()
    assert geofence is not None
    assert geofence.business_type == "cafe", f"Expected 'cafe', got '{geofence.business_type}'"
    assert geofence.name == "Test Cafe"
    assert json.loads(geofence.coordinates) == data["coordinates"]
    assert geofence.active is False

def test_get_geofences(client, init_database):
    """Test GET /geofences retrieves all geofences."""
    geofence = Geofence(
        business_type="supermarket",
        name="Test Market",
        coordinates=json.dumps([{"lat": 53.7, "lng": -1.4}]),
        active=True
    )
    db.session.add(geofence)
    db.session.commit()
    response = client.get('/geofences')
    assert response.status_code == 200
    assert len(response.json) == 1
    assert response.json[0]["business_type"] == "supermarket"
    assert response.json[0]["name"] == "Test Market"
    assert response.json[0]["active"] is True

def test_track_event(client, init_database):
    """Test POST /api/track_event stores a tracking event."""
    geofence = Geofence(
        business_type="cafe",
        name="Test Cafe",
        coordinates=json.dumps([]),
        active=False
    )
    db.session.add(geofence)
    db.session.commit()
    data = {
        "user_id": "User1",
        "user_name": "Test User",
        "geofence_id": geofence.id,
        "geofence_name": "Test Cafe",
        "event_type": "entry",
        "timestamp": "2025-04-07T10:00:00",
        "duration": 1.0,
        "simulated_hour": 10.0
    }
    response = client.post('/api/track_event', json=data)
    assert response.status_code == 201
    assert response.json["message"] == "Event tracked successfully"
    tracking = Tracking.query.first()
    assert tracking.user_id == "User1"
    assert tracking.user_name == "Test User"
    assert tracking.geofence_id == geofence.id
    assert tracking.event_type == "entry"
    assert tracking.timestamp == datetime.fromisoformat("2025-04-07T10:00:00")
    assert tracking.duration == 1.0
    assert tracking.simulated_hour == 10.0

def test_get_patterns(client, init_database):
    """Test GET /api/patterns generates correct patterns."""
    geofence = Geofence(
        business_type="cafe",
        name="Test Cafe",
        coordinates=json.dumps([]),
        active=True
    )
    db.session.add(geofence)
    db.session.commit()
    for i in range(3):
        tracking = Tracking(
            user_id="User1",
            user_name="Test User",
            geofence_id=geofence.id,
            geofence_name="Test Cafe",
            event_type="entry",
            timestamp=datetime(2025, 4, 7 + i * 7, 10, 0),  # Mondays
            duration=1.0,
            simulated_hour=10.0
        )
        db.session.add(tracking)
    db.session.commit()
    response = client.get('/api/patterns')
    assert response.status_code == 200
    assert len(response.json) >= 1
    pattern = response.json[0]
    assert pattern["user_id"] == "User1"
    assert pattern["geofence_id"] == geofence.id
    assert pattern["day_of_week"] == "Monday"
    assert pattern["hour"] == 10
    assert pattern["confidence"] > 50