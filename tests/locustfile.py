from locust import HttpUser, task, between

class GeofenceUser(HttpUser):
    """Simulate users accessing geofence and pattern endpoints."""
    wait_time = between(1, 5)

    @task
    def get_geofences(self):
        """Test GET /geofences performance."""
        self.client.get("/geofences")

    @task
    def get_patterns(self):
        """Test GET /api/patterns performance."""
        self.client.get("/api/patterns")

class SimulationUser(HttpUser):
    """Simulate users running simulations."""
    wait_time = between(1, 5)

    @task
    def run_simulation(self):
        """Test POST /api/run_simulation performance."""
        self.client.post("/api/run_simulation", json={"num_users": 100, "num_weeks": 8})