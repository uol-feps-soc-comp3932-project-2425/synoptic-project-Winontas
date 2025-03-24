from flask import Blueprint, request, jsonify, render_template
from app import db
from app.models import Geofence, Tracking
from app.data.competitors import competitor_locations
import json
from datetime import datetime
import os

geofence_bp = Blueprint('geofence', __name__)

@geofence_bp.route('/geofences', methods=['POST'])
def create_geofence():
    data = request.json
    new_geofence = Geofence(
        business_type=data['business_type'],
        name=data['name'],
        coordinates=json.dumps(data['coordinates']),
        active=False
    )
    db.session.add(new_geofence)
    db.session.commit()
    return jsonify({"message": "Geofence created", "id": new_geofence.id}), 201

@geofence_bp.route('/geofences', methods=['GET'])
def get_geofences():
    geofences = Geofence.query.all()
    return jsonify([{
        "id": g.id,
        "business_type": g.business_type,
        "name": g.name,
        "coordinates": json.loads(g.coordinates),
        "active": g.active
    } for g in geofences])

@geofence_bp.route('/geofences/<int:geofence_id>', methods=['PUT'])
def update_geofence(geofence_id):
    geofence = Geofence.query.get(geofence_id)
    if not geofence:
        return jsonify({"error": "Geofence not found"}), 404
    data = request.json
    geofence.business_type = data.get('business_type', geofence.business_type)
    geofence.name = data.get('name', geofence.name)
    geofence.coordinates = json.dumps(data['coordinates'])
    geofence.active = data.get('active', geofence.active)
    db.session.commit()
    return jsonify({"message": "Geofence updated"}), 200

@geofence_bp.route('/geofences/<int:geofence_id>', methods=['DELETE'])
def delete_geofence(geofence_id):
    geofence = Geofence.query.get(geofence_id)
    if not geofence:
        return jsonify({"error": "Geofence not found"}), 404
    db.session.delete(geofence)
    db.session.commit()
    return jsonify({"message": "Geofence deleted"})

@geofence_bp.route('/geofences/<int:geofence_id>/toggle', methods=['PUT'])
def toggle_geofence(geofence_id):
    geofence = Geofence.query.get(geofence_id)
    if not geofence:
        return jsonify({"error": "Geofence not found"}), 404
    geofence.active = not geofence.active
    db.session.commit()
    return jsonify({"message": "Geofence toggled"})

@geofence_bp.route('/dashboard', methods=['GET'])
def dashboard():
    return render_template('dashboard.html')

@geofence_bp.route('/competitors/<business_type>', methods=['GET'])
def get_competitors(business_type):
    competitors = competitor_locations.get(business_type, [])
    return jsonify(competitors)

@geofence_bp.route('/api/save_tracking', methods=['POST'])
def save_tracking():
    data = request.json
    new_tracking = Tracking(
        user_id=data['user_id'],
        user_name=data['user_name'],
        geofence_id=data['geofence_id'],
        geofence_name=data['geofence_name'],
        event_type=data['event_type'],
        timestamp=datetime.fromisoformat(data['timestamp']),
        duration=data.get('duration')
    )
    db.session.add(new_tracking)
    db.session.commit()
    return jsonify({"message": "Tracking data saved"}), 201

@geofence_bp.route('/api/patterns', methods=['GET'])
def get_patterns():
    patterns = db.session.query(
        Tracking.user_id,
        Tracking.user_name,
        Tracking.geofence_id,
        Tracking.geofence_name,
        db.func.strftime('%w', Tracking.timestamp).label('day_of_week'),
        db.func.strftime('%H', Tracking.timestamp).label('hour'),
        db.func.count().label('visits')
    ).filter(Tracking.event_type == 'entry')\
     .group_by(
        Tracking.user_id, Tracking.user_name, Tracking.geofence_id, Tracking.geofence_name,
        'day_of_week', 'hour'
     ).having(db.func.count() > 1)\
     .all()

    result = []
    for p in patterns:
        result.append({
            "user_id": p.user_id,
            "user_name": p.user_name,
            "geofence_id": p.geofence_id,
            "geofence_name": p.geofence_name,
            "day_of_week": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][int(p.day_of_week)],
            "hour": int(p.hour),
            "visit_count": p.visits
        })
    return jsonify(result)

@geofence_bp.route('/api/simulated_users', methods=['GET'])
def get_simulated_users():
    dataset = request.args.get('dataset', 'patterns')
    file_map = {
        'patterns': 'simulated_users_patterns.json',
        'random': 'simulated_users_random.json'
    }
    
    if dataset not in file_map:
        return jsonify({"error": "Invalid dataset"}), 400
    
    file_path = os.path.join(os.path.dirname(__file__), 'data', file_map[dataset])
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify({"error": "Dataset not found"}), 404