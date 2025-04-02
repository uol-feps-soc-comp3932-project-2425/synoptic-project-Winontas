from flask import Blueprint, request, jsonify, render_template
from app import db
from app.models import Geofence, Tracking
from app.data.competitors import competitor_locations
import json
from datetime import datetime
import os
from random import randint, uniform, choice
from datetime import timedelta


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

# New endpoint to save tracking events
@geofence_bp.route('/api/track_event', methods=['POST'])
def track_event():
    data = request.get_json()
    tracking = Tracking(
        user_id=data['user_id'],
        user_name=data['user_name'],
        geofence_id=data['geofence_id'],
        geofence_name=data['geofence_name'],
        event_type=data['event_type'],
        timestamp=datetime.fromisoformat(data['timestamp']),
        duration=data.get('duration'),
        simulated_hour=data['simulated_hour']
    )
    db.session.add(tracking)
    db.session.commit()
    return jsonify({'message': 'Event tracked successfully'}), 201

@geofence_bp.route('/api/tracking', methods=['GET'])
def get_tracking():
    tracking_entries = Tracking.query.all()
    return jsonify([{
        "id": t.id,
        "user_id": t.user_id,
        "user_name": t.user_name,
        "geofence_id": t.geofence_id,
        "geofence_name": t.geofence_name,
        "event_type": t.event_type,
        "timestamp": t.timestamp.isoformat(),
        "duration": t.duration,
        "simulated_hour": t.simulated_hour  # Include simulated_hour
    } for t in tracking_entries])

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
    

@geofence_bp.route('/test')
def test():
    return render_template('test.html')




def generate_user_behavior(user_id, num_weeks, geofences):
    home = {"lat": 53.7996 + uniform(-0.05, 0.05), "lng": -1.5492 + uniform(-0.05, 0.05)}
    movements = []
    triggers = []

    # Generate 1-2 routines per user, each with a unique day
    user_routines = []
    available_days = list(range(7))  # 0-6 for Sunday-Saturday
    for _ in range(randint(1, 2)):  # Reduced from 1-3 to 1-2 for less density
        if not available_days:
            break
        day = choice(available_days)
        available_days.remove(day)  # Ensure no duplicate days
        geofence = choice(geofences)
        hour = uniform(9, 19)  # Between 9 AM and 7 PM for more realistic shopping hours
        frequency = choice(["every", "everyOther", "once"])
        visits_per_day = 1  # Limit to 1 visit per routine per day (we'll cap total later)
        user_routines.append({
            "geofenceId": geofence.id,
            "geofenceName": geofence.name,
            "day": day,
            "hour": hour,
            "frequency": frequency,
            "visitsPerDay": visits_per_day
        })

    for week in range(num_weeks):
        start_time = datetime(2025, 3, 31) + timedelta(weeks=week)
        for day in range(7):
            day_time = start_time + timedelta(days=day)
            current_hour = 8

            # Daily work routine
            work = {"lat": 53.7996 + uniform(-0.02, 0.02), "lng": -1.5492 + uniform(-0.02, 0.02)}
            movements.append({"from": home, "to": work, "time": day_time + timedelta(hours=current_hour)})
            current_hour += 8
            movements.append({"from": work, "to": home, "time": day_time + timedelta(hours=current_hour)})

            # Track occupied hours and limit total geofence visits per day
            occupied_hours = set()
            daily_visits = 0
            max_daily_visits = 2  # Cap at 2 geofence visits per day

            for routine in user_routines:
                if routine["day"] == day:
                    if (routine["frequency"] == "every") or \
                       (routine["frequency"] == "everyOther" and week % 2 == 0) or \
                       (routine["frequency"] == "once" and week == 0):
                        geofence = Geofence.query.get(routine["geofenceId"])
                        if geofence and daily_visits < max_daily_visits:
                            coords = json.loads(geofence.coordinates)[0]
                            destination = {"lat": coords["lat"], "lng": coords["lng"]}
                            visit_hour = routine["hour"]
                            # Round to nearest hour and ensure no overlap
                            visit_hour_int = int(round(visit_hour))
                            if visit_hour_int in occupied_hours or visit_hour_int < 9 or visit_hour_int > 20:
                                continue  # Skip if hour is occupied or outside 9 AM - 8 PM
                            occupied_hours.add(visit_hour_int)
                            occupied_hours.add(visit_hour_int + 1)  # Include return trip
                            daily_visits += 1

                            movements.append({"from": home, "to": destination, "time": day_time + timedelta(hours=visit_hour)})
                            triggers.append({
                                "user_id": f"User{user_id}",
                                "user_name": f"SimUser{user_id}",
                                "geofence_id": geofence.id,
                                "geofence_name": geofence.name,
                                "event_type": "entry",
                                "timestamp": (day_time + timedelta(hours=visit_hour)).isoformat(),
                                "duration": 1.0,
                                "simulated_hour": visit_hour_int + (day * 24) + (week * 168)
                            })
                            movements.append({"from": destination, "to": home, "time": day_time + timedelta(hours=visit_hour + 1)})

    return {"home": home, "movements": movements}, triggers

@geofence_bp.route('/api/run_simulation', methods=['POST'])
def api_run_simulation():
    data = request.get_json()
    num_users = data.get('num_users', 5)
    num_weeks = data.get('num_weeks', 4)

    geofences = Geofence.query.all()
    if not geofences:
        return jsonify({"error": "No geofences available. Please create geofences before running a simulation."}), 400

    if num_users < 1 or num_weeks < 1:
        return jsonify({"error": "Number of users and weeks must be at least 1."}), 400

    all_users = []
    all_triggers = []

    Tracking.query.delete()
    db.session.commit()

    for i in range(1, num_users + 1):
        user_data, triggers = generate_user_behavior(i, num_weeks, geofences)
        all_users.append({"id": f"User{i}", "name": f"SimUser{i}", "home": user_data["home"], "movements": user_data["movements"]})
        all_triggers.extend(triggers)

    for trigger in all_triggers:
        tracking = Tracking(
            user_id=trigger["user_id"],
            user_name=trigger["user_name"],
            geofence_id=trigger["geofence_id"],
            geofence_name=trigger["geofence_name"],
            event_type=trigger["event_type"],
            timestamp=datetime.fromisoformat(trigger["timestamp"]),
            duration=trigger["duration"],
            simulated_hour=trigger["simulated_hour"]
        )
        db.session.add(tracking)
    db.session.commit()

    return jsonify({"users": all_users, "triggers": all_triggers})

@geofence_bp.route('/simulate')
def simulate():
    return render_template('simulate.html')