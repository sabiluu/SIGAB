"""
Script to create the database schemas using SQLAlchemy.
"""

from app.core.database import engine, Base

# Import all models here so that Base.metadata.create_all() registers them
from app.models.user import User
from app.models.village import Village
from app.models.shelter import Shelter
from app.models.sos_ticket import SOSTicket
from app.models.flood_probability_log import FloodProbabilityLog
from app.models.river_discharge_log import RiverDischargeLog
from app.models.weather_data_log import WeatherDataLog
from app.models.emergency_status import EmergencyStatus
from app.models.notification import Notification
from app.models.system_config import SystemConfig

def init_db():
    print("Creating database tables...")
    # This will create all tables defined in the models
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_db()
