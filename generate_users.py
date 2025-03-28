import json
import random
import os
import requests

LEEDS_BOUNDS = {"min_lat": 53.75, "max_lat": 53.85, "min_lng": -1.65, "max_lng": -1.45}
BUSINESS_TYPES = ["supermarket", "fitness_supplement", "cafe"]
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
API_KEY = "AIzaSyAFplA5X2oW5-rRak8s4HT6JhBuZl53wp8"

def fetch_real_locations(business_type, num_results=5):
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.location"
    }
    body = {"textQuery": f"{business_type} in Leeds, UK"}
    response = requests.post(url, headers=headers, json=body)
    if response.ok and response.json().get("places"):
        places = response.json()["places"][:num_results]
        return [{"lat": p["location"]["latitude"], "lng": p["location"]["longitude"]} for p in places]
    return [{"lat": random.uniform(LEEDS_BOUNDS["min_lat"], LEEDS_BOUNDS["max_lat"]),
             "lng": random.uniform(LEEDS_BOUNDS["min_lng"], LEEDS_BOUNDS["max_lng"])}]

REAL_LOCATIONS = {bt: fetch_real_locations(bt) for bt in BUSINESS_TYPES}

def generate_user(id, name):
    schedule = [
        {
            "day": random.choice(DAYS),
            "start_hour": random.randint(8, 18),
            "duration": random.uniform(0.5, 3),
            "location": random.choice(BUSINESS_TYPES),
            "coords": random.choice(REAL_LOCATIONS[random.choice(BUSINESS_TYPES)])
        } for _ in range(random.randint(2, 5))
    ]
    
    return {
        "id": id,
        "name": name,
        "start_lat": random.uniform(LEEDS_BOUNDS["min_lat"], LEEDS_BOUNDS["max_lat"]),
        "start_lng": random.uniform(LEEDS_BOUNDS["min_lng"], LEEDS_BOUNDS["max_lng"]),
        "schedule": schedule
    }

def generate_dataset(filename, num_users, description):
    users = [generate_user(i + 1, f"User_{i + 1}") for i in range(num_users)]
    data = {"description": description, "users": users}
    with open(os.path.join("app/data", filename), "w") as f:
        json.dump(data, f, indent=4)

if __name__ == "__main__":
    generate_dataset("simulated_users_patterns.json", 50, "Patterns-based simulated users with real Places API locations")