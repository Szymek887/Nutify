from flask import jsonify, request
from ..db.ups import data_lock, db
from core.logger import ups_logger as logger

# Import functions from upscmd module
from .upscmd import (
    get_ups_commands,
    execute_command,
    get_command_stats,
    _init_models_if_needed
)

# Import UPSCommand - we'll initialize it in each function
UPSCommand = None

def register_api_routes(app):
    """Register all API routes for the upscmd section"""
    
    @app.route('/api/upscmd/list')
    def get_ups_commands_api():
        """Returns the list of available commands for the UPS"""
        try:
            commands = get_ups_commands()
            return jsonify({
                'success': True,
                'commands': commands
            })
        except Exception as e:
            logger.error(f"Error getting UPS commands: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @app.route('/api/upscmd/execute', methods=['POST'])
    def execute_ups_command_api():
        """Executes a command on the UPS"""
        try:
            command = request.json.get('command')
            if not command:
                return jsonify({
                    'success': False,
                    'error': 'No command specified'
                }), 400

            success, output = execute_command(command)
            return jsonify({
                'success': success,
                'output': output
            })
        except Exception as e:
            logger.error(f"Error executing UPS command: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @app.route('/api/upscmd/stats')
    def api_get_command_stats():
        """API to get command execution statistics"""
        try:
            # Try using the function from upscmd.py
            try:
                stats = get_command_stats()
                return jsonify({
                    'success': True,
                    'total': stats['total'],
                    'successful': stats['successful'],
                    'failed': stats['failed']
                })
            except Exception as inner_e:
                logger.warning(f"Could not get stats via get_command_stats: {str(inner_e)}")
                
                # Fallback: initialize UPSCommand model and query directly
                global UPSCommand
                _init_models_if_needed()
                
                # Get UPSCommand directly from ModelClasses
                if UPSCommand is None and hasattr(db, 'ModelClasses') and hasattr(db.ModelClasses, 'UPSCommand'):
                    UPSCommand = db.ModelClasses.UPSCommand
                    logger.debug("📚 UPSCommand model initialized directly in api_get_command_stats")
                
                if UPSCommand is None:
                    logger.error("❌ UPSCommand model not initialized for getting stats")
                    return jsonify({'success': False, 'error': 'UPSCommand model not initialized'})
                    
                with data_lock:
                    # Calculate stats directly
                    total_commands = UPSCommand.query.count()
                    successful_commands = UPSCommand.query.filter_by(success=True).count()
                    failed_commands = UPSCommand.query.filter_by(success=False).count()
                    
                    return jsonify({
                        'success': True,
                        'total': total_commands,
                        'successful': successful_commands,
                        'failed': failed_commands
                    })
                
        except Exception as e:
            logger.error(f"Error getting command stats: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @app.route('/api/upscmd/logs')
    def api_get_command_logs():
        """API to get command execution logs"""
        try:
            # Initialize UPSCommand model
            global UPSCommand
            
            # First call the initialization function
            _init_models_if_needed()
            
            # Now get the UPSCommand directly from ModelClasses
            if UPSCommand is None and hasattr(db, 'ModelClasses') and hasattr(db.ModelClasses, 'UPSCommand'):
                UPSCommand = db.ModelClasses.UPSCommand
                logger.debug("📚 UPSCommand model initialized directly in api_get_command_logs")
            
            if UPSCommand is None:
                logger.error("❌ UPSCommand model not initialized for getting logs")
                return jsonify({'success': False, 'error': 'UPSCommand model not initialized'})
            
            with data_lock:
                # Get last 10 command logs
                logs = []
                recent_commands = UPSCommand.query.order_by(
                    UPSCommand.timestamp.desc()
                ).limit(10).all()
                
                for cmd in recent_commands:
                    logs.append({
                        'command': cmd.command,
                        'success': cmd.success,
                        'output': cmd.output,
                        'timestamp': cmd.timestamp.isoformat() if cmd.timestamp else None
                    })
                
                return jsonify({
                    'success': True,
                    'logs': logs
                })
        except Exception as e:
            logger.error(f"Error getting command logs: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @app.route('/api/upscmd/clear/logs', methods=['POST'])
    def api_clear_command_logs():
        """API to clear the command logs"""
        try:
            # Initialize UPSCommand model
            global UPSCommand
            
            # First call the initialization function
            _init_models_if_needed()
            
            # Now get the UPSCommand directly from ModelClasses
            if UPSCommand is None and hasattr(db, 'ModelClasses') and hasattr(db.ModelClasses, 'UPSCommand'):
                UPSCommand = db.ModelClasses.UPSCommand
                logger.debug("📚 UPSCommand model initialized directly in api_clear_command_logs")
            
            if UPSCommand is None:
                logger.error("❌ UPSCommand model not initialized for clearing logs")
                return jsonify({'success': False, 'error': 'UPSCommand model not initialized'})
            
            with data_lock:
                # Delete all records from the correct table
                UPSCommand.query.delete()
                db.session.commit()
            return jsonify({'success': True})
        except Exception as e:
            logger.error(f"Error clearing command logs: {str(e)}")
            return jsonify({'success': False, 'error': str(e)})
    
    return app 