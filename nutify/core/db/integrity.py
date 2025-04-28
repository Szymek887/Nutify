"""
Database integrity check module.
This module verifies database tables integrity using ORM models.
"""

import logging
import os
import time
import sqlite3
from sqlalchemy import inspect, MetaData, Table, text
from sqlalchemy.exc import SQLAlchemyError, OperationalError, ProgrammingError
from sqlalchemy.schema import CreateTable
import traceback

from core.logger import database_logger as logger

def check_database_integrity(db):
    """
    Verifies database integrity using SQLAlchemy ORM.
    Compares actual database tables schema with ORM models.
    If schema mismatch is detected, drops and recreates the table.
    
    Args:
        db: SQLAlchemy database instance
        
    Returns:
        dict: Dictionary with tables checked and their status
    """
    # Protected tables that should never be verified or modified
    # These tables are managed directly by core/db_module.py
    PROTECTED_TABLES = ['ups_static_data', 'ups_dynamic_data']
    
    logger.info("🔍 Starting database integrity check...")
    results = {}
    
    try:
        # Get all existing tables in the database
        inspector = inspect(db.engine)
        existing_tables = set(inspector.get_table_names())
        logger.info(f"📊 Found {len(existing_tables)} existing tables in database")
        
        # Using ORM-based table creation
        logger.info("ℹ️ Using ORM for table integrity")
        
        # Log the start of integrity check
        logger.info("==================================================")
        logger.info("📊 Integrity check using ORM-based approach")
        logger.info("==================================================")
        
        # Get all SQLAlchemy models from the ModelClasses object
        if hasattr(db, 'ModelClasses'):
            models = {}
            for attr_name in dir(db.ModelClasses):
                attr = getattr(db.ModelClasses, attr_name)
                if hasattr(attr, '__tablename__') and not attr_name.startswith('_'):
                    models[attr.__tablename__] = attr
            
            logger.info(f"Found {len(models)} models to check")
            
            # Check each table against its model
            for table_name, model in models.items():
                # Skip protected tables
                if table_name in PROTECTED_TABLES:
                    results[table_name] = "PROTECTED"
                    logger.info(f"🛡️ Table {table_name} is protected, skipping")
                    continue
                
                try:
                    # Check if table exists in database
                    if table_name in existing_tables:
                        # Get database columns
                        db_columns = {c['name']: c for c in inspector.get_columns(table_name)}
                        
                        # Get model columns
                        model_columns = {c.name: c for c in model.__table__.columns}
                        
                        logger.debug(f"Checking table {table_name}: DB has {len(db_columns)} columns, Model has {len(model_columns)} columns")
                        
                        # Check for schema mismatches
                        mismatch = False
                        
                        # 1. Check for missing columns
                        missing_columns = set(model_columns.keys()) - set(db_columns.keys())
                        if missing_columns:
                            logger.warning(f"❌ Table {table_name} is missing columns: {missing_columns}")
                            mismatch = True
                        
                        # 2. Check for column type mismatches
                        # This is more complex as SQLAlchemy types may not match DB types exactly
                        # We'll do a basic string comparison of the type names
                        for col_name, model_col in model_columns.items():
                            # Skip columns that don't exist in DB
                            if col_name in db_columns:
                                db_col = db_columns[col_name]
                                
                                # Get type name from model
                                model_type = str(model_col.type)
                                
                                # Get type name from database
                                db_type = db_col['type']
                                
                                # Compare type definitions (basic comparison)
                                # Note: This is not perfect as SQLAlchemy types might be represented
                                # differently in different databases, but should catch major differences
                                if not model_type.lower().startswith(str(db_type).lower()):
                                    logger.warning(f"❌ Column {table_name}.{col_name} type mismatch: DB={db_type}, Model={model_type}")
                                    mismatch = True
                        
                        if mismatch:
                            logger.warning(f"⚠️ Schema mismatch detected for table {table_name}")
                            logger.warning(f"🔄 Dropping and recreating table {table_name}")
                            
                            # Force close all SQLAlchemy sessions and connections
                            try:
                                db.session.remove()
                            except:
                                pass
                            
                            # Force drop the table using direct SQLite connection
                            if force_drop_table(db, table_name):
                                # Wait a moment to ensure the database releases locks
                                time.sleep(0.5)
                                
                                try:
                                    # Now recreate the table using the model definition
                                    model.__table__.create(db.engine)
                                    results[table_name] = "RECREATED"
                                    logger.info(f"✅ Table {table_name} recreated successfully")
                                except OperationalError as oe:
                                    error_msg = f"❌ SQLAlchemy operational error recreating table {table_name}: {str(oe)}"
                                    logger.error(error_msg)
                                    results[table_name] = "ERROR: " + error_msg
                                except ProgrammingError as pe:
                                    error_msg = f"❌ SQLAlchemy programming error creating table {table_name}: {str(pe)}"
                                    logger.error(error_msg)
                                    results[table_name] = "ERROR: " + error_msg
                                except Exception as e:
                                    error_msg = f"❌ Error recreating table {table_name}: {str(e)}"
                                    logger.error(error_msg)
                                    logger.error(traceback.format_exc())
                                    results[table_name] = "ERROR: " + error_msg
                            else:
                                error_msg = f"❌ Failed to drop table {table_name}"
                                logger.error(error_msg)
                                results[table_name] = "ERROR: " + error_msg
                        else:
                            results[table_name] = "OK"
                            logger.info(f"✅ Table {table_name} schema matches ORM model")
                    else:
                        # Table doesn't exist, create it
                        try:
                            logger.info(f"🆕 Creating table {table_name} which doesn't exist")
                            model.__table__.create(db.engine)
                            results[table_name] = "CREATED"
                            logger.info(f"✅ Table {table_name} created")
                        except OperationalError as oe:
                            error_msg = f"❌ SQLAlchemy operational error creating table {table_name}: {str(oe)}"
                            logger.error(error_msg)
                            results[table_name] = "ERROR: " + error_msg
                        except ProgrammingError as pe:
                            error_msg = f"❌ SQLAlchemy programming error creating table {table_name}: {str(pe)}"
                            logger.error(error_msg)
                            results[table_name] = "ERROR: " + error_msg
                        except Exception as e:
                            error_msg = f"❌ Error creating table {table_name}: {str(e)}"
                            logger.error(error_msg)
                            logger.error(traceback.format_exc())
                            results[table_name] = "ERROR: " + error_msg
                except Exception as e:
                    error_msg = f"❌ Error checking table {table_name}: {str(e)}"
                    logger.error(error_msg)
                    logger.error(traceback.format_exc())
                    results[table_name] = "ERROR: " + error_msg
        else:
            logger.warning("⚠️ db.ModelClasses not available, skipping schema verification")
            
            # Mark tables as ORM managed except protected ones (original behavior)
            for table in existing_tables:
                if table not in PROTECTED_TABLES:
                    results[table] = "ORM_MANAGED"
        
        logger.info("==================================================")
        logger.info("📊 Integrity check complete")
        logger.info("==================================================")
        
    except Exception as e:
        error_msg = f"❌ Error during integrity check: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        
    return results

def force_drop_table(db, table_name):
    """
    Force drop a table using direct SQLite connection to bypass any SQLAlchemy transaction issues.
    
    Args:
        db: SQLAlchemy database instance
        table_name: Name of the table to drop
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Safety check for protected tables
        PROTECTED_TABLES = ['ups_dynamic_data']
        if table_name in PROTECTED_TABLES:
            logger.warning(f"🔒 Cannot drop protected table {table_name}")
            return False
        
        # Get database path from SQLAlchemy engine
        db_path = db.engine.url.database
        
        if db_path:
            logger.info(f"🗑️ Force dropping table {table_name} using direct SQLite connection")
            
            # Close any existing SQLAlchemy connections
            db.engine.dispose()
            
            # Use direct SQLite connection
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Drop table and commit immediately
            cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
            conn.commit()
            
            # Close connection
            cursor.close()
            conn.close()
            
            logger.info(f"🗑️ Table {table_name} dropped successfully via direct SQLite connection")
            return True
        else:
            # If using in-memory DB or can't get path, fall back to SQLAlchemy
            logger.warning(f"⚠️ Cannot determine SQLite DB path, using SQLAlchemy fallback for {table_name}")
            with db.engine.connect() as conn:
                conn.execute(text(f"DROP TABLE IF EXISTS {table_name}"))
                conn.commit()
            logger.info(f"🗑️ Table {table_name} dropped via SQLAlchemy")
            return True
            
    except Exception as e:
        logger.error(f"❌ Error force dropping table {table_name}: {str(e)}")
        logger.error(traceback.format_exc())
        return False 