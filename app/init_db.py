"""
Script to create the database schemas using SQLAlchemy.
"""

from sqlalchemy import text, inspect
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
from app.models.flood_incident import FloodIncident
from app.models.audit_log import AuditLog

def auto_migrate_columns():
    """Memeriksa dan menambahkan kolom baru yang belum ada di tabel database yang sudah terbentuk."""
    try:
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        
        with engine.begin() as conn:
            for table_name, table in Base.metadata.tables.items():
                if table_name not in existing_tables:
                    continue
                
                existing_cols = {col["name"] for col in inspector.get_columns(table_name)}
                for col in table.columns:
                    if col.name not in existing_cols:
                        col_type = col.type.compile(engine.dialect)
                        print(f"Adding missing column '{col.name}' ({col_type}) to table '{table_name}'...")
                        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}"))
    except Exception as e:
        print(f"Note during column auto-migration: {e}")

def init_db():
    print("Creating database tables...")
    # This will create all tables defined in the models
    Base.metadata.create_all(bind=engine)
    auto_migrate_columns()
    print("Database tables created and synchronized successfully!")

if __name__ == "__main__":
    init_db()
