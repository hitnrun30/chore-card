"""Chore Card Integration for Home Assistant."""

from __future__ import annotations

import logging
import os
import shutil
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.const import Platform

PLATFORMS = [Platform.SENSOR]

from .const import DOMAIN
from .frontend import ChoreCardRegistration

_LOGGER = logging.getLogger(__name__)


def ensure_directory(hass: HomeAssistant):
    """Ensure the frontend destination directory exists (blocking)."""
    frontend_dest = hass.config.path("www/community/chore-card")

    if not os.path.exists(frontend_dest):
        os.makedirs(frontend_dest, exist_ok=True)
        _LOGGER.info(f"✅ Created frontend destination folder: {frontend_dest}")


def copy_frontend_files(hass: HomeAssistant):
    """Copy frontend files synchronously from the integration folder to the www folder."""
    frontend_source = hass.config.path("custom_components/chore_card/frontend")
    frontend_dest = hass.config.path("www/community/chore-card")

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


async def async_setup(hass: HomeAssistant, config: dict):
    """Set up the Chore Card integration (global setup)."""
    _LOGGER.info("🛠️ Setting up Chore Card integration (global setup)")

    # ✅ Ensure frontend files exist on every Home Assistant startup
    await hass.async_add_executor_job(ensure_directory, hass)
    await hass.async_add_executor_job(copy_frontend_files, hass)

    return True  # ✅ Ensure Home Assistant knows the setup was successful


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Chore Card from a config entry."""
    _LOGGER.info(f"Setting up Chore Card integration for {entry.entry_id}")

    hass.data.setdefault(DOMAIN, {})

    # Store the config entry
    hass.data[DOMAIN][entry.entry_id] = entry.data

    # ✅ Ensure frontend files exist on integration setup
    await hass.async_add_executor_job(ensure_directory, hass)
    await hass.async_add_executor_job(copy_frontend_files, hass)

    # ✅ Register frontend first to ensure Lovelace finds it
    frontend_registration = ChoreCardRegistration(hass)
    await frontend_registration.async_register()

    # ✅ Forward setup to the sensor platform
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    _LOGGER.info("Chore Card Component Setup Completed")

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry and remove all related resources if no instances remain."""
    _LOGGER.info(f"🔴 Unloading Chore Card integration for {entry.entry_id}")

    def get_instance_count():
        """Count the number of active instances of Chore Card."""
        count = sum(
            1 for e in hass.config_entries.async_entries(DOMAIN) if not e.disabled_by
        )
        _LOGGER.info(f"🔍 Active Chore Card instances remaining: {count}")
        return count

    try:
        # ✅ Step 1: Remove sensor entity (if it exists)
        entity_id = f"sensor.{entry.entry_id}"
        if hass.states.get(entity_id):
            hass.states.async_remove(entity_id)
            _LOGGER.info(f"✅ Removed sensor entity: {entity_id}")

        # ✅ Step 2: Remove stored data
        hass.data[DOMAIN].pop(entry.entry_id, None)
        _LOGGER.info("✅ Removed stored data for this entry.")

        # ✅ Step 3: If this is the last integration, remove frontend files
        if get_instance_count() == 1:
            _LOGGER.info("🛑 Last instance removed. Cleaning up frontend resources.")

            frontend_registration = ChoreCardRegistration(hass)
            await frontend_registration.async_unregister()  # ✅ Unregister Lovelace
            _LOGGER.info("✅ Unregistered Chore Card frontend.")

            # ✅ Remove the frontend files from `/www/community/chore-card/`
            frontend_dest = hass.config.path("www/community/chore-card")

            def remove_frontend_files():
                """Delete the Chore Card frontend directory."""
                if os.path.exists(frontend_dest):
                    _LOGGER.info(f"🗑️ Removing frontend folder: {frontend_dest}")
                    shutil.rmtree(frontend_dest, ignore_errors=True)

            await hass.async_add_executor_job(remove_frontend_files)
            _LOGGER.info("✅ Successfully removed frontend files.")

        # ✅ Step 4: Unload platforms
        unload_result = await hass.config_entries.async_unload_platforms(
            entry, PLATFORMS
        )
        _LOGGER.info(f"✅ Unloaded platforms: {unload_result}")

        return unload_result

    except Exception as e:
        _LOGGER.error(f"❌ Error while unloading Chore Card: {e}")
        return False
