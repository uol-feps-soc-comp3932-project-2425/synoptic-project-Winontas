from app import db, create_app
from app.models import Geofence, Tracking

app = create_app()
app.app_context().push()

def clean_duplicates():
    # Fetch all geofences
    geofences = Geofence.query.order_by(Geofence.id.asc()).all()
    seen_names = {}
    duplicates = []

    # Keep the latest entry per name
    for g in geofences:
        if g.name in seen_names:
            duplicates.append(seen_names[g.name])  # Mark older entry as duplicate
            seen_names[g.name] = g.id  # Update to latest ID
        else:
            seen_names[g.name] = g.id

    # Delete duplicates
    if duplicates:
        Geofence.query.filter(Geofence.id.in_(duplicates)).delete(synchronize_session=False)
        print(f"Deleted {len(duplicates)} duplicate geofences.")
    else:
        print("No duplicates found.")

    # Optional: Clear tracking data
    Tracking.query.delete()
    print("Cleared all tracking data.")

    db.session.commit()

if __name__ == "__main__":
    clean_duplicates()