"""
Centralized ORM Model Classes Container

This module provides a centralized container for all database models used in the application.
It helps avoid circular imports and provides a single access point for all models.

Usage:
    from core.db.model_classes import ModelClasses
    
    # Access models
    user = ModelClasses.UPSEvent.query.first()
"""

from datetime import datetime


class ModelClasses:
    """Container for all database models used in the application."""
    
    # Static models imported from core.db.orm
    UPSEvent = None
    VariableConfig = None
    UPSCommand = None
    UPSVariable = None
    MailConfig = None
    NtfyConfig = None
    WebhookConfig = None
    NotificationSettings = None
    ReportSchedule = None
    InitialSetup = None
    
    # Dynamic models created by db_module.py
    UPSStaticData = None
    UPSDynamicData = None


def init_model_classes(db_instance, timezone_getter):
    """
    Initialize the ModelClasses with all required database models.
    
    Args:
        db_instance: SQLAlchemy database instance
        timezone_getter: Function to get the configured timezone
        
    Returns:
        ModelClasses: Initialized ModelClasses container
    """
    from core.logger import database_logger as logger
    
    # Create a new ModelClasses instance
    models = ModelClasses()
    
    # Initialize models from the orm package
    from core.db.orm import init_models as init_orm_models
    orm_models = init_orm_models(db_instance, timezone_getter)
    
    # Add models from orm
    models.UPSEvent = orm_models['UPSEvent']
    models.VariableConfig = orm_models['VariableConfig']
    models.UPSCommand = orm_models['UPSCommand']
    models.UPSVariable = orm_models['UPSVariable']
    models.MailConfig = orm_models['MailConfig']
    models.NtfyConfig = orm_models['NtfyConfig']
    models.WebhookConfig = orm_models['WebhookConfig']
    models.NotificationSettings = orm_models['NotificationSettings']
    models.ReportSchedule = orm_models['ReportSchedule']
    models.InitialSetup = orm_models['InitialSetup']
    
    # Log models loaded
    logger.info(f"✅ Loaded {len(orm_models)} ORM models from orm package")
    
    # Return the initialized ModelClasses
    return models


def register_models_for_global_access(models, db_instance):
    """
    Register models for global access in db_module and other modules.
    
    Args:
        models: ModelClasses instance with initialized models
        db_instance: SQLAlchemy database instance
    """
    from core.logger import database_logger as logger
    
    # Register models in db_module.py
    from core.db.ups import register_models_from_modelclasses
    register_models_from_modelclasses(models)
    
    # Register models for scheduler
    from core.db.ups import register_models_for_scheduler
    register_models_for_scheduler()
    
    logger.info("✅ Models registered for global access")


def register_dynamic_models(models, static_model, dynamic_model):
    """
    Register dynamically created models in ModelClasses.
    
    Args:
        models: ModelClasses instance
        static_model: UPSStaticData model class
        dynamic_model: UPSDynamicData model class
    """
    from core.logger import database_logger as logger
    
    # Register dynamic models
    models.UPSStaticData = static_model
    models.UPSDynamicData = dynamic_model
    
    logger.info("✅ Registered dynamic models in ModelClasses") 