from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.typing import ConfigType
import os
import shutil
import logging

DOMAIN = "chore_card"
_LOGGER = logging.getLogger(__name__)

async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    _LOGGER.info("Chore Card frontend installing")

    """Set up the Chore Card integration."""
    hass.data.setdefault(DOMAIN, {})
    
    # Register the frontend
    await async_register_frontend(hass)

    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Chore Card from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = entry.data

    # Register frontend resources
    await async_register_frontend(hass)

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    hass.data[DOMAIN].pop(entry.entry_id)
    return True

async def async_register_frontend(hass: HomeAssistant):
    """Ensure frontend files are available for Lovelace."""
    frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
    dest_dir = hass.config.path("www/community/chore-card")

    # Ensure destination exists
    if not os.path.exists(dest_dir):
        os.makedirs(dest_dir)

    for filename in ["chore-card.js", "chore-card.css"]:
        source_path = os.path.join(frontend_dir, filename)
        dest_path = os.path.join(dest_dir, filename)

        if os.path.exists(source_path):
            try:
                shutil.copy(source_path, dest_path)
                _LOGGER.info(f"Copied {filename} to {dest_dir}")
            except Exception as e:
                _LOGGER.error(f"Error copying {filename}: {e}")

    # Register Lovelace resources dynamically
    hass.http.register_static_path("/community_plugin/chore-card", dest_dir, cache_headers=True)
    
    _LOGGER.info("Chore Card frontend registered at /community_plugin/chore-card")
