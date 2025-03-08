"""Chore Card Integration for Home Assistant."""
from __future__ import annotations

import logging
import os
import shutil
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.const import Platform

PLATFORMS = [Platform.SENSOR]

from .const import DOMAIN
from .frontend import ChoreCardRegistration

_LOGGER = logging.getLogger(__name__)

async def async_setup(hass, config):
    """Set up the Chore Card integration (global setup)."""
    _LOGGER.info("🛠️ Setting up Chore Card integration (global setup)")

    # ✅ Define source and destination paths for frontend files
    frontend_source = hass.config.path("custom_components/chore_card/frontend")
    frontend_dest = hass.config.path("www/community/chore_card")

    # ✅ Log paths for debugging
    _LOGGER.info(f"🔍 Frontend source path: {frontend_source}")
    _LOGGER.info(f"🔍 Frontend destination path: {frontend_dest}")

    def ensure_directory():
        """Ensure the frontend destination directory exists (blocking)."""
        try:
            community_dir = hass.config.path("www/community")

            _LOGGER.info(f"🔍 Checking if community directory exists: {community_dir}")
            if not os.path.exists(community_dir):
                os.makedirs(community_dir, exist_ok=True)
                _LOGGER.info(f"✅ Created directory: {community_dir}")

            _LOGGER.info(f"🔍 Checking if frontend directory exists: {frontend_dest}")
            if not os.path.exists(frontend_dest):
                os.makedirs(frontend_dest, exist_ok=True)
                _LOGGER.info(f"✅ Created frontend destination folder: {frontend_dest}")

        except Exception as e:
            _LOGGER.error(f"❌ Failed to create frontend directories: {e}")

    def copy_frontend_files():
        """Copy frontend files synchronously to avoid blocking the event loop."""
        try:
            if not os.path.exists(frontend_source):
                _LOGGER.error(f"❌ Frontend source folder not found: {frontend_source}")
                return False  # Prevent further execution if files are missing

            files = os.listdir(frontend_source)
            for filename in files:
                src_path = os.path.join(frontend_source, filename)
                dest_path = os.path.join(frontend_dest, filename)

                if os.path.isfile(src_path):
                    should_copy = not os.path.exists(dest_path) or (
                        os.path.getmtime(src_path) > os.path.getmtime(dest_path)
                    )

                    if should_copy:
                        shutil.copy(src_path, dest_path)
                        _LOGGER.info(f"✅ Copied {filename} to {frontend_dest}")

            _LOGGER.info("🎉 Chore Card frontend files copied successfully!")
        except Exception as e:
            _LOGGER.error(f"❌ Failed to copy Chore Card frontend files: {e}")

    # ✅ Run directory creation and file copying in a blocking way (prevents async skipping)
    await hass.async_add_executor_job(ensure_directory)
    await hass.async_add_executor_job(copy_frontend_files)

    _LOGGER.info("✅ Chore Card setup completed successfully!")

    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Chore Card from a config entry."""
    _LOGGER.info(f"Setting up Chore Card integration for {entry.entry_id}")

    hass.data.setdefault(DOMAIN, {})

    # Store the config entry
    hass.data[DOMAIN][entry.entry_id] = entry.data

    # ✅ Register frontend first to ensure Lovelace finds it
    frontend_registration = ChoreCardRegistration(hass)
    await frontend_registration.async_register()

    # ✅ Forward setup to the sensor platform
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)    

    _LOGGER.info("Chore Card Component Setup Completed")

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    _LOGGER.info(f"Unloading Chore Card integration for {entry.entry_id}")

    def get_instance_count(hass: HomeAssistant) -> int:
        """Count the number of active instances of Chore Card."""
        entries = [
            entry
            for entry in hass.config_entries.async_entries(DOMAIN)
            if not entry.disabled_by
        ]
        return len(entries)

    # ✅ Only remove resources if this is the last instance
    if get_instance_count(hass) == 0:
        _LOGGER.info("Removing Chore Card Lovelace resources")

        frontend_registration = ChoreCardRegistration(hass)
        await frontend_registration.async_unregister()

        # ✅ Remove Lovelace resource entry
        resources = hass.data["lovelace"].resources
        js_url = "/hacsfiles/chore-card/chore-card.js"

        for resource in resources.async_items():
            if resource["url"] == js_url:
                await resources.async_delete_item(resource["id"])
                _LOGGER.info(f"Removed Chore Card JS Resource: {js_url}")
                break  # ✅ Stop after removing the first match

        # ✅ Remove the frontend files from /www/community/chore-card/
        frontend_dest = hass.config.path("www/community/chore_card")

        def remove_frontend_files():
            """Delete the Chore Card frontend directory."""
            if os.path.exists(frontend_dest):
                shutil.rmtree(frontend_dest)
                _LOGGER.info("Successfully removed /www/community/chore_card/")

        await hass.async_add_executor_job(remove_frontend_files)

    # ✅ Remove the sensor entity before unloading the integration
    entity_id = f"sensor.{entry.entry_id}"
    if hass.states.get(entity_id):
        hass.states.async_remove(entity_id)
        _LOGGER.info(f"Removed sensor entity {entity_id}")

    # ✅ Remove stored data
    hass.data[DOMAIN].pop(entry.entry_id, None)

    # ✅ Remove the service
    hass.services.async_remove(DOMAIN, "update")

    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
