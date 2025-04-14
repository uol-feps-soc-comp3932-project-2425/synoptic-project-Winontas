from flask import Blueprint, request, jsonify, render_template
from app import db
from app.models import Geofence, Tracking
from app.data.competitors import competitor_locations
import json
from datetime import datetime, timedelta
import os
from random import randint, uniform, choice
from sklearn.cluster import KMeans
import numpy as np
import google.generativeai as genai
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import time
import schedule
import threading
from dotenv import load_dotenv
# Load environment variables
load_dotenv()


GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
SENDER_EMAIL = os.getenv("SENDER_EMAIL")

required_vars = {
    "GOOGLE_API_KEY": GOOGLE_API_KEY,
    "SENDGRID_API_KEY": SENDGRID_API_KEY,
    "SENDER_EMAIL": SENDER_EMAIL
}
for name, value in required_vars.items():
    if not value:
        raise ValueError(f"Environment variable {name} is not set!")

genai.configure(api_key=GOOGLE_API_KEY)
gemini_model = genai.GenerativeModel("gemini-1.5-flash")
sendgrid_client = SendGridAPIClient(SENDGRID_API_KEY)

# Scheduling thread
def run_scheduler():
    while True:
        schedule.run_pending()
        time.sleep(60)

scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
scheduler_thread.start()

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
        "simulated_hour": t.simulated_hour
    } for t in tracking_entries])

@geofence_bp.route('/api/patterns', methods=['GET'])
def get_patterns():
    triggers = Tracking.query.filter_by(event_type='entry').all()
    if not triggers:
        return jsonify([])

    # Prepare data: [user_id, geofence_id, day_of_week (0-6), hour (0-23), minute (0-59)]
    data = []
    trigger_info = []
    for t in triggers:
        timestamp = t.timestamp
        data.append([
            hash(t.user_id),  # Numeric representation of user_id
            hash(t.geofence_id),  # Numeric representation of geofence_id
            timestamp.weekday(),
            timestamp.hour,
            timestamp.minute
        ])
        trigger_info.append({
            "user_id": t.user_id,
            "user_name": t.user_name,
            "geofence_id": t.geofence_id,
            "geofence_name": t.geofence_name
        })

    if len(data) < 2:  # Need at least 2 points for clustering
        return jsonify([])

    # Convert to numpy array
    X = np.array(data)

    # Apply K-means clustering (adjust n_clusters based on data size)
    n_clusters = min(5, len(data) // 2)  # Arbitrary cap at 5 or half the data points
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    labels = kmeans.fit_predict(X)

    # Calculate cluster centroids and confidence
    patterns = {}
    for i, label in enumerate(labels):
        cluster_key = (trigger_info[i]["user_id"], trigger_info[i]["geofence_id"], label)
        if cluster_key not in patterns:
            patterns[cluster_key] = {
                "user_id": trigger_info[i]["user_id"],
                "user_name": trigger_info[i]["user_name"],
                "geofence_id": trigger_info[i]["geofence_id"],
                "geofence_name": trigger_info[i]["geofence_name"],
                "times": [],
                "count": 0
            }
        patterns[cluster_key]["times"].append(X[i])
        patterns[cluster_key]["count"] += 1

    # Compute pattern details and confidence
    result = []
    for key, pattern in patterns.items():
        if pattern["count"] > 1:  # Only consider clusters with multiple entries
            times = np.array(pattern["times"])
            centroid = times.mean(axis=0)  # Average day, hour, minute
            distances = np.linalg.norm(times - centroid, axis=1)  # Euclidean distance to centroid
            avg_distance = distances.mean()
            # Confidence: Inverse of avg_distance, normalized (arbitrary scale)
            confidence = max(0, min(100, 100 - (avg_distance * 2)))  # Higher distance = lower confidence

            result.append({
                "user_id": pattern["user_id"],
                "user_name": pattern["user_name"],
                "geofence_id": pattern["geofence_id"],
                "geofence_name": pattern["geofence_name"],
                "day_of_week": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][int(round(centroid[2]))],
                "hour": int(round(centroid[3])),
                "minute": int(round(centroid[4])),
                "visit_count": pattern["count"],
                "confidence": round(confidence, 2)  # Percentage
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

def generate_user_behavior(user_id, num_weeks, geofences):
    home = {"lat": 53.7996 + uniform(-0.05, 0.05), "lng": -1.5492 + uniform(-0.05, 0.05)}
    movements = []
    triggers = []

    # Generate 1-2 routines per user, each with a unique day
    user_routines = []
    available_days = list(range(7))  # 0-6 for Sunday-Saturday
    for _ in range(randint(1, 2)):
        if not available_days:
            break
        day = choice(available_days)
        available_days.remove(day)
        geofence = choice(geofences)
        base_hour = uniform(9, 19)  # Base hour between 9 AM and 7 PM
        frequency = choice(["every", "everyOther", "once"])
        visits_per_day = 1
        user_routines.append({
            "geofenceId": geofence.id,
            "geofenceName": geofence.name,
            "day": day,
            "base_hour": base_hour,  # Store base hour for variation
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

            # Track occupied times and limit total geofence visits per day
            occupied_times = set()  # Store as minutes past midnight
            daily_visits = 0
            max_daily_visits = 2

            for routine in user_routines:
                if routine["day"] == day:
                    if (routine["frequency"] == "every") or \
                       (routine["frequency"] == "everyOther" and week % 2 == 0) or \
                       (routine["frequency"] == "once" and week == 0):
                        geofence = Geofence.query.get(routine["geofenceId"])
                        if geofence and daily_visits < max_daily_visits:
                            coords = json.loads(geofence.coordinates)[0]
                            destination = {"lat": coords["lat"], "lng": coords["lng"]}
                            
                            # Add variation to the base hour (±15 minutes)
                            variation_minutes = uniform(-15, 15)  # Random minutes
                            visit_hour = routine["base_hour"] + (variation_minutes / 60)
                            visit_hour_int = int(round(visit_hour))
                            visit_minutes = int((visit_hour - visit_hour_int) * 60)
                            visit_seconds = randint(0, 59)  # Random seconds

                            # Check for overlap and bounds
                            total_minutes = (visit_hour_int * 60) + visit_minutes
                            if (total_minutes in occupied_times or 
                                visit_hour_int < 9 or visit_hour_int > 20):
                                continue
                            occupied_times.add(total_minutes)
                            occupied_times.add(total_minutes + 60)  # Assume 1-hour visit
                            daily_visits += 1

                            visit_time = day_time + timedelta(hours=visit_hour_int, minutes=visit_minutes, seconds=visit_seconds)
                            movements.append({"from": home, "to": destination, "time": visit_time})
                            triggers.append({
                                "user_id": f"User{user_id}",
                                "user_name": f"SimUser{user_id}",
                                "geofence_id": geofence.id,
                                "geofence_name": geofence.name,
                                "event_type": "entry",
                                "timestamp": visit_time.isoformat(),
                                "duration": 1.0,
                                "simulated_hour": visit_hour_int + (day * 24) + (week * 168)
                            })
                            movements.append({"from": destination, "to": home, "time": visit_time + timedelta(hours=1)})

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

@geofence_bp.route('/patterns')
def patterns():
    return render_template('patterns.html')

@geofence_bp.route('/api/run_simulation_results', methods=['GET'])
def api_run_simulation_results():
    triggers = Tracking.query.all()
    triggers_data = [{
        "user_id": t.user_id,
        "user_name": t.user_name,
        "geofence_id": t.geofence_id,
        "geofence_name": t.geofence_name,
        "event_type": t.event_type,
        "timestamp": t.timestamp.isoformat(),
        "duration": t.duration,
        "simulated_hour": t.simulated_hour
    } for t in triggers]
    return jsonify({"triggers": triggers_data})


@geofence_bp.route('/notifications')
def notifications():
    return render_template('notifications.html')

@geofence_bp.route('/api/eligible_users', methods=['GET'])
def get_eligible_users():
    try:
        triggers = Tracking.query.filter_by(event_type='entry').all()
        if not triggers:
            return jsonify([])

        data = [[hash(t.user_id), hash(t.geofence_id), t.timestamp.weekday(), t.timestamp.hour, t.timestamp.minute] for t in triggers]
        if len(data) < 2:
            return jsonify([])

        X = np.array(data)
        n_clusters = min(5, len(data) // 2)
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        labels = kmeans.fit_predict(X)

        patterns = {}
        for i, label in enumerate(labels):
            t = triggers[i]
            cluster_key = (t.user_id, t.geofence_id, label)
            if cluster_key not in patterns:
                patterns[cluster_key] = {
                    "user_id": t.user_id,
                    "user_name": t.user_name,
                    "geofence_id": t.geofence_id,
                    "geofence_name": t.geofence_name,
                    "times": [],
                    "count": 0
                }
            patterns[cluster_key]["times"].append(X[i])
            patterns[cluster_key]["count"] += 1

        eligible_users = set()
        for key, pattern in patterns.items():
            if pattern["count"] > 1:
                times = np.array(pattern["times"])
                centroid = times.mean(axis=0)
                distances = np.linalg.norm(times - centroid, axis=1)
                confidence = max(0, min(100, 100 - (distances.mean() * 2)))
                if confidence >= 80:
                    eligible_users.add((pattern["user_id"], pattern["user_name"]))

        result = [{"user_id": uid, "user_name": uname} for uid, uname in eligible_users]
        return jsonify(result)
    except Exception as e:
        print(f"Error in get_eligible_users: {str(e)}")
        return jsonify({"error": str(e)}), 500

@geofence_bp.route('/api/send_notifications', methods=['POST'])
def send_notifications():
    try:
        data = request.json
        user_ids = data.get("user_ids", [])
        channels = data.get("channels", [])
        message_template = data.get("message_template", "")
        style = data.get("style", "neutral")

        if not user_ids or not channels or not message_template:
            return jsonify({"error": "Missing required fields"}), 400

        triggers = Tracking.query.filter_by(event_type='entry').all()
        patterns = {}
        for t in triggers:
            if t.user_id in user_ids:
                key = (t.user_id, t.geofence_id)
                if key not in patterns:
                    patterns[key] = {"user_id": t.user_id, "user_name": t.user_name, "geofence_name": t.geofence_name}

        sent_notifications = []
        for user_id in user_ids:
            user_pattern = next((p for p in patterns.values() if p["user_id"] == user_id), None)
            if user_pattern:
                personalized_msg = personalize_message(user_pattern, message_template, style)
                for channel in channels:
                    if channel == "email":
                        status = "Pending"
                        try:
                            user_email = f"williamtsinontas@gmail.com"  # Replace with test email
                            email = Mail(
                                from_email=SENDER_EMAIL,
                                to_emails=user_email,
                                subject="Exclusive Offer Just for You!",
                                html_content=personalized_msg
                            )
                            response = sendgrid_client.send(email)
                            status = "Delivered" if response.status_code == 202 else "Failed"
                        except Exception as e:
                            print(f"Error sending email to {user_pattern['user_name']}: {str(e)}")
                            status = "Failed"

                        sent_notifications.append({
                            "user_id": user_id,
                            "user_name": user_pattern["user_name"],
                            "channel": channel,
                            "message": personalized_msg,
                            "timestamp": datetime.now().isoformat(),
                            "status": status
                        })
                        time.sleep(0.5)  # Respect free tier limits

        return jsonify({"status": "success", "sent_notifications": sent_notifications})
    except Exception as e:
        print(f"Error in send_notifications: {str(e)}")
        return jsonify({"error": str(e)}), 500

@geofence_bp.route('/api/schedule_notifications', methods=['POST'])
def schedule_notifications():
    try:
        data = request.json
        user_ids = data.get("user_ids", [])
        channels = data.get("channels", [])
        message_template = data.get("message_template", "")
        style = data.get("style", "neutral")

        if not user_ids or not channels or not message_template:
            return jsonify({"error": "Missing required fields"}), 400

        triggers = Tracking.query.filter_by(event_type='entry').all()
        patterns = {}
        for t in triggers:
            if t.user_id in user_ids:
                key = (t.user_id, t.geofence_id)
                if key not in patterns:
                    patterns[key] = {"user_id": t.user_id, "user_name": t.user_name, "geofence_name": t.geofence_name}

        scheduled_times = []
        for user_id in user_ids:
            user_pattern = next((p for p in patterns.values() if p["user_id"] == user_id), None)
            if user_pattern:
                user_triggers = [t for t in triggers if t.user_id == user_id]
                schedule_time = None
                if len(user_triggers) >= 2:
                    times = np.array([[t.timestamp.weekday(), t.timestamp.hour] for t in user_triggers])
                    kmeans = KMeans(n_clusters=1, random_state=42)
                    kmeans.fit(times)
                    centroid = kmeans.cluster_centers_[0]
                    weekday = int(round(centroid[0]))
                    hour = int(round(centroid[1]))
                    weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                    schedule_time = f"{weekday_names[weekday]}, {hour:02d}:00"

                    # Calculate next occurrence
                    now = datetime.now()
                    days_ahead = (weekday - now.weekday()) % 7 or 7
                    send_dt = (now + timedelta(days=days_ahead)).replace(hour=hour, minute=0, second=0, microsecond=0)
                    if send_dt <= now:
                        send_dt += timedelta(days=7)

                    # Schedule email
                    personalized_msg = personalize_message(user_pattern, message_template, style)
                    schedule.every().week.at(f"{hour:02d}:00").do(
                        send_scheduled_email,
                        user_email=f"{user_pattern['user_name'].lower()}@example.com",  # Replace with test email
                        user_name=user_pattern["user_name"],
                        message=personalized_msg
                    ).tag(f"email_{user_id}")

                scheduled_times.append({
                    "user_id": user_id,
                    "user_name": user_pattern["user_name"],
                    "time": schedule_time or "No pattern detected"
                })

        return jsonify({"status": "success", "scheduled_times": scheduled_times})
    except Exception as e:
        print(f"Error in schedule_notifications: {str(e)}")
        return jsonify({"error": str(e)}), 500

def send_scheduled_email(user_email, user_name, message):
    try:
        email = Mail(
            from_email=SENDER_EMAIL,
            to_emails=user_email,
            subject="Exclusive Offer Just for You!",
            html_content=message
        )
        response = sendgrid_client.send(email)
        status = "Delivered" if response.status_code == 202 else "Failed"
        print(f"Scheduled email to {user_name}: {status}")
        # Log to database or file if needed
    except Exception as e:
        print(f"Error sending scheduled email to {user_name}: {str(e)}")
    finally:
        # Remove job after execution
        for job in schedule.get_jobs(f"email_{user_name}"):
            schedule.cancel_job(job)

def personalize_message(pattern, template, style):
    user_name = pattern["user_name"]
    geofence = pattern["geofence_name"]
    if "casual" in style.lower():
        return f"Hey {user_name}, loved {geofence}? We've got some cool deals for you!"
    elif "discount" in style.lower():
        return f"{user_name}, save big at {geofence} with our exclusive offers!"
    return template.format(user_name=user_name, geofence=geofence)

@geofence_bp.route('/api/suggest_message', methods=['POST'])
def suggest_message():
    try:
        data = request.json
        user_ids = data.get("user_ids", [])
        style = data.get("style", "neutral")

        if not user_ids:
            return jsonify({"error": "No users selected"}), 400

        triggers = Tracking.query.filter_by(event_type='entry').all()
        sample_pattern = next((t for t in triggers if t.user_id in user_ids), None)
        if not sample_pattern:
            return jsonify({"error": "No pattern data available"}), 404

        # Calculate scheduled times for all users
        scheduled_times = []
        for user_id in user_ids:
            user_triggers = [t for t in triggers if t.user_id == user_id]
            schedule_time = None
            if len(user_triggers) >= 2:
                times = np.array([[t.timestamp.weekday(), t.timestamp.hour] for t in user_triggers])
                kmeans = KMeans(n_clusters=1, random_state=42)
                kmeans.fit(times)
                centroid = kmeans.cluster_centers_[0]
                weekday = int(round(centroid[0]))
                hour = int(round(centroid[1]))
                weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                schedule_time = f"{weekday_names[weekday]}, {hour:02d}:00"
            user_name = next((t.user_name for t in user_triggers), "Unknown")
            scheduled_times.append({
                "user_id": user_id,
                "user_name": user_name,
                "time": schedule_time or "No pattern detected"
            })

        try:
            prompt = f"""
            Generate a marketing email for {sample_pattern.user_name} who visited {sample_pattern.geofence_name}. 
            Style: '{style}' (e.g., casual and inviting, highlight discounts, neutral). 
            Keep it engaging, under 50 words, tied to their visit to {sample_pattern.geofence_name}. 
            Do NOT mention specific times or tracking details to avoid sounding intrusive.
            """
            response = gemini_model.generate_content(
                prompt,
                generation_config={
                    "max_output_tokens": 50,
                    "temperature": 0.7
                }
            )
            suggestion = response.text.strip()
            return jsonify({
                "suggestion": suggestion,
                "scheduled_times": scheduled_times
            })
        except Exception as e:
            error_message = str(e)
            status_code = 500
            if "Quota exceeded" in error_message or "rate limit" in error_message:
                status_code = 429
                error_message = "Gemini API rate limit exceeded. Try again later."
            elif "API key" in error_message:
                status_code = 401
                error_message = "Invalid Gemini API key."
            return jsonify({"error": error_message}), status_code
    except Exception as e:
        print(f"Error in suggest_message: {str(e)}")
        return jsonify({"error": str(e)}), 500