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

# Corrected paths for HACS-managed frontend files
FRONTEND_SOURCE_PATH = os.path.join(os.path.dirname(__file__), "frontend")
FRONTEND_TARGET_PATH = lambda hass: hass.config.path("www/community/chore-card/")

async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up Chore Card integration."""
    hass.data.setdefault(DOMAIN, {})

    LOGGER.info("Initializing Chore Card integration.")

    # Ensure frontend files are copied
    await hass.async_add_executor_job(copy_frontend_files, hass)

    # Register the frontend resource dynamically
    await hass.async_add_executor_job(register_frontend_resource, hass)

    # Load the sensor platform
    hass.async_create_task(async_load_platform(hass, "sensor", DOMAIN, {}, config))

    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Chore Card from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    LOGGER.info("Setting up Chore Card entry.")

    # Ensure frontend files are copied
    await hass.async_add_executor_job(copy_frontend_files, hass)

    # Register the frontend resource dynamically
    await hass.async_add_executor_job(register_frontend_resource, hass)

    # Forward setup to the sensor platform
    hass.async_create_task(hass.config_entries.async_forward_entry_setup(entry, "sensor"))

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    LOGGER.info("Unloading Chore Card entry.")

    # Unregister frontend resource
    await hass.async_add_executor_job(unregister_frontend_resource, hass)

    return await hass.config_entries.async_forward_entry_unload(entry, "sensor")

def copy_frontend_files(hass: HomeAssistant):
    """Ensure frontend files are copied to /config/www/community/chore-card/."""
    target_path = FRONTEND_TARGET_PATH(hass)

    try:
        if not os.path.exists(target_path):
            os.makedirs(target_path)

        for filename in ["chore-card.js", "chore-card.css"]:
            source_file = os.path.join(FRONTEND_SOURCE_PATH, filename)
            target_file = os.path.join(target_path, filename)

            if os.path.exists(source_file):
                shutil.copy2(source_file, target_file)
                LOGGER.info(f"Copied {filename} to {target_path}")
            else:
                LOGGER.warning(f"Missing frontend file: {source_file}")

    except Exception as e:
        LOGGER.error(f"Error copying frontend files: {e}")

def register_frontend_resource(hass: HomeAssistant):
    """Register Lovelace resource for chore-card.js dynamically."""
    frontend_path = "/local/community/chore-card/chore-card.js"
    resource_type = "module"

    resources = hass.data.get("lovelace", {}).get("resources", [])

    if not any(res["url"] == frontend_path for res in resources):
        resources.append({"url": frontend_path, "type": resource_type})
        LOGGER.info("Registered frontend resource: %s", frontend_path)

def unregister_frontend_resource(hass: HomeAssistant):
    """Unregister Lovelace resource for chore-card.js dynamically."""
    frontend_path = "/local/community/chore-card/chore-card.js"

    if "lovelace" in hass.data and "resources" in hass.data["lovelace"]:
        resources = hass.data["lovelace"]["resources"]
        if any(res["url"] == frontend_path for res in resources):
            hass.data["lovelace"]["resources"] = [
                res for res in resources if res["url"] != frontend_path
            ]
            LOGGER.info("Unregistered frontend resource: %s", frontend_path)
