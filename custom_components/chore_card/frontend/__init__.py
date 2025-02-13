import os
import shutil
import logging

_LOGGER = logging.getLogger(__name__)

def setup(hass, config):
    """Move frontend files to the correct location."""
    source_dir = os.path.dirname(__file__)  # Path to `/custom_components/chore_card/frontend/`
    dest_dir = hass.config.path("www/community/chore-card/")  # Target location
    
    os.makedirs(dest_dir, exist_ok=True)  # Ensure the destination exists

    # Copy JS and CSS files
    for filename in ["chore-card.js", "chore-card.css"]:
        source_file = os.path.join(source_dir, filename)
        dest_file = os.path.join(dest_dir, filename)
        
        if os.path.exists(source_file):
            try:
                shutil.copy(source_file, dest_file)
                _LOGGER.info(f"Copied {filename} to {dest_dir}")
            except Exception as e:
                _LOGGER.error(f"Error copying {filename}: {e}")
    
    return True
