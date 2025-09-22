#!/usr/bin/env python3
"""
Migration script to convert existing JSON face database to SQLite
This script will migrate data from face_database.json to face_database.db
"""

import os
import sys
import json
import logging
from pathlib import Path

# Add backend to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(backend_dir)
sys.path.insert(0, parent_dir)

from backend.utils.database_manager import FaceDatabaseManager

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def migrate_json_to_sqlite():
    """Migrate existing JSON database to SQLite"""
    
    # Paths
    json_path = "data/face_database.json"
    sqlite_path = "data/face_database.db"
    backup_json_path = "data/face_database_backup.json"
    
    logger.info("Starting migration from JSON to SQLite...")
    
    # Check if JSON file exists
    if not os.path.exists(json_path):
        logger.error(f"JSON database not found at {json_path}")
        return False
    
    # Check if SQLite database already exists
    if os.path.exists(sqlite_path):
        response = input(f"SQLite database already exists at {sqlite_path}. Overwrite? (y/N): ")
        if response.lower() != 'y':
            logger.info("Migration cancelled by user")
            return False
        
        # Backup existing SQLite database
        backup_sqlite_path = "data/face_database_backup.db"
        if os.path.exists(backup_sqlite_path):
            os.remove(backup_sqlite_path)
        os.rename(sqlite_path, backup_sqlite_path)
        logger.info(f"Backed up existing SQLite database to {backup_sqlite_path}")
    
    try:
        # Load JSON data
        logger.info(f"Loading JSON data from {json_path}")
        with open(json_path, 'r') as f:
            json_data = json.load(f)
        
        logger.info(f"Found {len(json_data)} persons in JSON database")
        
        # Create SQLite database manager
        db_manager = FaceDatabaseManager(sqlite_path)
        
        # Migrate data
        logger.info("Starting data migration...")
        migration_success, error_msg = db_manager.migrate_from_json(json_path)
        
        if migration_success:
            logger.info("✅ Migration completed successfully!")
            
            # Verify migration
            all_persons = db_manager.get_all_persons()
            logger.info(f"Verification: {len(all_persons)} persons in SQLite database")
            
            if len(all_persons) == len(json_data):
                logger.info("✅ Data verification successful - all persons migrated")
                
                # Create backup of original JSON file
                if os.path.exists(backup_json_path):
                    os.remove(backup_json_path)
                os.rename(json_path, backup_json_path)
                logger.info(f"Original JSON file backed up to {backup_json_path}")
                
                # Get stats
                stats = db_manager.get_stats()
                logger.info(f"Migration summary:")
                logger.info(f"  - Total persons: {stats['total_persons']}")
                logger.info(f"  - SQLite database: {sqlite_path}")
                logger.info(f"  - JSON backup: {backup_json_path}")
                
                return True
            else:
                logger.error(f"❌ Data verification failed: Expected {len(json_data)} persons, got {len(all_persons)}")
                return False
        else:
            logger.error(f"❌ Migration failed: {error_msg}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Migration error: {e}")
        return False

def main():
    """Main migration function"""
    logger.info("Face Database Migration Tool")
    logger.info("=" * 50)
    
    success = migrate_json_to_sqlite()
    
    if success:
        logger.info("🎉 Migration completed successfully!")
        logger.info("The backend will now use SQLite for face database storage.")
        logger.info("Your original JSON file has been backed up for safety.")
    else:
        logger.error("❌ Migration failed. Please check the logs above.")
        sys.exit(1)

if __name__ == "__main__":
    main()