from flask import Blueprint, request, jsonify, render_template
from app import db
from app.models import Geofence
from app.data.competitors import competitor_locations

import json

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
    return jsonify({"message": "Geofence created"}), 201

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


# Add the dashboard route
@geofence_bp.route('/dashboard', methods=['GET'])
def dashboard():
    return render_template('dashboard.html')

@geofence_bp.route('/competitors/<business_type>', methods=['GET'])
def get_competitors(business_type):
    competitors = competitor_locations.get(business_type, [])
    return jsonify(competitors)