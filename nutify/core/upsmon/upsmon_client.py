from flask import jsonify, current_app
from flask_socketio import emit
from datetime import datetime
import pytz
from ..db.ups import db, data_lock
from ..logger import upsmon_logger as logger
from ..db.model_classes import ModelClasses

logger.info("🌑 Initializing upsmon_client")

# Initialize UPSEvent from ModelClasses
UPSEvent = None

def _init_models_if_needed():
    """Initialize UPSEvent model from ModelClasses if needed"""
    global UPSEvent
    if UPSEvent is None:
        # Check if we can get the model from the db.ModelClasses namespace
        if hasattr(db, 'ModelClasses') and hasattr(db.ModelClasses, 'UPSEvent'):
            UPSEvent = db.ModelClasses.UPSEvent
            logger.debug("📚 UPSEvent model initialized from db.ModelClasses")
        else:
            # Fall back to using core.db.models if ModelClasses isn't initialized
            from ..db.models import init_models
            # Use CACHE_TIMEZONE from the Flask app
            init_models(db, lambda: current_app.CACHE_TIMEZONE)
            
            # Try again to get the model
            if hasattr(db, 'ModelClasses') and hasattr(db.ModelClasses, 'UPSEvent'):
                UPSEvent = db.ModelClasses.UPSEvent
                logger.debug("📚 UPSEvent model initialized after init_models")
            else:
                logger.error("❌ Failed to initialize UPSEvent model")

def handle_nut_event(app, data):
    """
    Handles NUT events received via Unix socket
    
    Args:
        app: Flask application instance
        data: Dictionary containing ups and event
    """
    try:
        logger.info(f"Processing NUT event: {data}")
        
        if not data:
            logger.error("No data received")
            return False
            
        ups = data.get('ups', 'unknown')
        event = data.get('event', 'unknown')
        
        # Use CACHE_TIMEZONE from the Flask app
        tz = app.CACHE_TIMEZONE
        now = datetime.now(tz)
        
        # Ensure UPSEvent is initialized
        _init_models_if_needed()
        
        # Save in the database
        with data_lock:
            db_event = UPSEvent(
                ups_name=ups,
                event_type=event,
                event_message=str(data),
                timestamp_utc=now,
                timestamp_utc_begin=now,
                source_ip=None,
                acknowledged=False
            )
            db.session.add(db_event)
            db.session.commit()
            logger.info(f"Event saved to database with id: {db_event.id}")
        
        # Save in the app memory for the events page
        if not hasattr(app, 'events_log'):
            app.events_log = []
        app.events_log.append(data)
        
        # Send via websocket
        if hasattr(app, 'socketio'):
            app.socketio.emit('nut_event', data)
            logger.debug("Event sent via WebSocket")
        
        # Handle email notification
        try:
            from ..mail import handle_notification
            handle_notification(data)  # Pass the event to mail.py
            logger.info("Email notification sent")
        except Exception as e:
            logger.error(f"Error sending email: {str(e)}")
        
        # Handle related events (e.g. ONLINE after ONBATT)
        if event == 'ONLINE':
            # Ensure UPSEvent is initialized
            _init_models_if_needed()
            
            with data_lock:
                prev_event = UPSEvent.query.filter_by(
                    event_type='ONBATT',
                    timestamp_utc_end=None
                ).order_by(UPSEvent.timestamp_utc.desc()).first()
                
                if prev_event:
                    prev_event.timestamp_utc_end = now
                    db.session.commit()
                    logger.debug("Closed previous ONBATT event")
        
        return True
        
    except Exception as e:
        logger.error(f"Error handling NUT event: {str(e)}", exc_info=True)
        return False

def get_event_history(app):
    """
    Retrieve the event history
    
    Args:
        app: Flask application instance
        
    Returns:
        Response: JSON with the event history
    """
    try:
        if not hasattr(app, 'events_log'):
            app.events_log = []
        return jsonify(app.events_log)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_events_table(rows='all'):
    """
    Retrieve the events table from the database
    
    Args:
        rows: Number of rows to retrieve ('all' for all)
        
    Returns:
        dict: Events table data
    """
    try:
        logger.debug(f"Request for events table with rows={rows}")
        
        # Ensure UPSEvent is initialized
        _init_models_if_needed()
        
        query = UPSEvent.query.order_by(UPSEvent.timestamp_utc.desc())
        
        if rows != 'all':
            query = query.limit(int(rows))
            
        events = query.all()
        logger.debug(f"Found {len(events)} events")
        
        # Get the column names
        columns = [column.name for column in UPSEvent.__table__.columns]
        
        # Prepare the row data using to_dict method for proper timezone conversion
        rows_data = []
        for event in events:
            # Use to_dict() to ensure proper timezone conversion
            if hasattr(event, 'to_dict'):
                event_dict = event.to_dict()
                
                # Make sure timestamps are in ISO format
                for ts_field in ['timestamp_utc', 'timestamp_utc_begin', 'timestamp_utc_end']:
                    if hasattr(event, ts_field) and getattr(event, ts_field):
                        event_dict[ts_field] = getattr(event, ts_field).isoformat()
                        
                rows_data.append(event_dict)
            else:
                # Fallback to manual conversion if to_dict is not available
                row = {}
                for column in columns:
                    value = getattr(event, column)
                    if isinstance(value, datetime):
                        # Convert UTC datetime objects to ISO format strings
                        value = value.isoformat()
                    row[column] = value
                rows_data.append(row)
            
        return {
            'columns': columns,
            'rows': rows_data
        }
                
    except Exception as e:
        logger.error(f"Error retrieving events: {str(e)}", exc_info=True)
        raise

def acknowledge_event(event_id):
    """
    Mark an event as acknowledged
    
    Args:
        event_id: ID of the event to acknowledge
        
    Returns:
        tuple: (success, message)
    """
    try:
        # Ensure UPSEvent is initialized
        _init_models_if_needed()
        
        with data_lock:
            event = UPSEvent.query.get(event_id)
            if event:
                event.acknowledged = True
                db.session.commit()
                return True, "Event acknowledged"
            return False, "Event not found"
    except Exception as e:
        logger.error(f"Error in handling the acknowledge: {str(e)}", exc_info=True)
        return False, str(e) 