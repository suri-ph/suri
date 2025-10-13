import argparse
import logging
import logging.config
import signal
import sys
import traceback
from pathlib import Path

import uvicorn

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from config import config, validate_model_paths, validate_directories

# Global flag for graceful shutdown
shutdown_flag = False

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    global shutdown_flag
    
    signal_name = 'SIGINT' if signum == signal.SIGINT else 'SIGTERM' if signum == signal.SIGTERM else f'Signal {signum}'
    print(f"\n🛑 Received {signal_name} - shutting down gracefully...")
    
    shutdown_flag = True
    sys.exit(0)

# Register signal handlers for graceful shutdown
signal.signal(signal.SIGINT, signal_handler)   # Ctrl+C
signal.signal(signal.SIGTERM, signal_handler)  # Termination request

# Windows-specific signal handling
if sys.platform == 'win32':
    try:
        signal.signal(signal.SIGBREAK, signal_handler)  # Windows Ctrl+Break
    except AttributeError:
        pass  # SIGBREAK not available on all platforms

def setup_logging():
    """Setup logging configuration"""
    logging.config.dictConfig(config["logging"])

def validate_setup():
    """Validate the setup before starting the server"""
    try:
        # Validate directories
        validate_directories()
        
        # Validate model paths
        validate_model_paths()
        
        return True
        
    except Exception as e:
        print(f"[FAIL] Setup validation failed: {e}")
        return False

def main():
    """Main entry point"""
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Face Detection API Backend")
    parser.add_argument("--port", type=int, help="Port to run the server on")
    parser.add_argument("--host", type=str, help="Host to run the server on")
    args = parser.parse_args()
    
    # Setup logging
    setup_logging()
    logger = logging.getLogger(__name__)
    
    # Validate setup
    if not validate_setup():
        print("Setup validation failed. Please check the configuration.")
        sys.exit(1)
    
    # Server configuration
    server_config = config["server"].copy()
    
    # Override with command line arguments if provided
    if args.port:
        server_config["port"] = args.port
    if args.host:
        server_config["host"] = args.host
    
    try:
        # Import the app directly for PyInstaller compatibility
        from main import app
        
        logger.info(f"Starting server on {server_config['host']}:{server_config['port']}")
        
        # Start the server
        uvicorn.run(
            app,
            host=server_config["host"],
            port=server_config["port"],
            reload=server_config["reload"],
            log_level=server_config["log_level"],
            workers=server_config["workers"],
            access_log=True,
        )
        
        logger.info("✅ Server stopped gracefully")
        
    except KeyboardInterrupt:
        logger.info("⚠️ Received KeyboardInterrupt - exiting...")
        print("\n⚠️ Server interrupted by user")
        sys.exit(0)
    except SystemExit:
        # Allow sys.exit() to propagate cleanly
        logger.info("✅ Server exiting...")
        raise
    except Exception as e:
        logger.error(f"❌ Server error: {e}")
        print(f"\n❌ Server error: {e}")
        print("Traceback:")
        traceback.print_exc()
        sys.exit(1)
    finally:
        # Final cleanup
        logger.info("🧹 Final cleanup...")
        print("🛑 Backend server stopped")

if __name__ == "__main__":
    main()