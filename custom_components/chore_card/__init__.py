"""Chore Card Integration for Home Assistant."""
from __future__ import annotations

import logging
import os
import shutil
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.discovery import async_load_platform
from homeassistant.helpers.typing import ConfigType

DOMAIN = "chore_card"
LOGGER = logging.getLogger(__name__)

# Path where frontend files are stored in the integration
FRONTEND_SOURCE_PATH = os.path.join(os.path.dirname(__file__), "frontend")

# Target path where files should be copied
FRONTEND_TARGET_PATH = "/config/www/community/chore-card"

async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up Chore Card integration."""
    hass.data.setdefault(DOMAIN, {})

    # Log setup
    LOGGER.info("Initializing Chore Card integration.")

    # Ensure frontend files are copied to the correct location
    await hass.async_add_executor_job(copy_frontend_files)

    # Load the sensor platform
    hass.async_create_task(async_load_platform(hass, "sensor", DOMAIN, {}, config))

    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Chore Card from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    # Log entry setup
    LOGGER.info("Setting up Chore Card entry.")

    # Ensure frontend files are copied to the correct location
    await hass.async_add_executor_job(copy_frontend_files)

    # Forward setup to the sensor platform
    hass.async_create_task(hass.config_entries.async_forward_entry_setup(entry, "sensor"))

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    LOGGER.info("Unloading Chore Card entry.")
    
    return await hass.config_entries.async_forward_entry_unload(entry, "sensor")

def copy_frontend_files():
    """Ensure frontend files are copied to /config/www/community/chore-card/."""
    try:
        if not os.path.exists(FRONTEND_TARGET_PATH):
            os.makedirs(FRONTEND_TARGET_PATH)

        for filename in ["chore-card.js", "chore-card.css"]:
            source_file = os.path.join(FRONTEND_SOURCE_PATH, filename)
            target_file = os.path.join(FRONTEND_TARGET_PATH, filename)

            if os.path.exists(source_file):
                shutil.copy2(source_file, target_file)
                LOGGER.info(f"Copied {filename} to {FRONTEND_TARGET_PATH}")
            else:
                LOGGER.warning(f"Missing frontend file: {source_file}")

    except Exception as e:
        LOGGER.error(f"Error copying frontend files: {e}")
