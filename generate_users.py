import json
import random

days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
locations = ["supermarket", "fitness_supplement", "cafe"]

users = []
for i in range(200):
    schedule = []
    for _ in range(random.randint(0, 5)):  # 0-5 weekly visits
        schedule.append({
            "day": random.choice(days),
            "start_hour": random.randint(0, 23),
            "duration": random.uniform(0.5, 3),  # 30 min to 3 hours
            "location": random.choice(locations)
        })
    users.append({
        "id": i + 1,
        "name": f"User{i + 1}",
        "start_lat": 53.8008 + (random.random() - 0.5) * 0.05,
        "start_lng": -1.5491 + (random.random() - 0.5) * 0.05,
        "schedule": schedule
    })

data = {"users": users, "description": "Large dataset with 200 users and random patterns"}
with open("app/data/simulated_users_large.json", "w") as f:
    json.dump(data, f, indent=4)

print("Generated simulated_users_large.json")