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
        # ✅ Step 1: Remove the sensor entity (if it exists)
        entity_id = f"sensor.{entry.entry_id}"
        if hass.states.get(entity_id):
            hass.states.async_remove(entity_id)
            _LOGGER.info(f"✅ Removed sensor entity: {entity_id}")

        # ✅ Step 2: Remove stored data for this entry
        hass.data[DOMAIN].pop(entry.entry_id, None)
        _LOGGER.info("✅ Removed stored data for this entry.")

        # ✅ Step 3: Unload platforms
        unload_result = await hass.config_entries.async_unload_platforms(
            entry, PLATFORMS
        )
        _LOGGER.info(f"✅ Unloaded platforms: {unload_result}")

        # ✅ Step 4: If there were multiple instances, do NOT remove frontend
        if get_instance_count() > 1:
            _LOGGER.info(
                "ℹ️ Other Chore Card instances still exist. Skipping frontend cleanup."
            )
            return unload_result

        # ✅ Step 5: Remove frontend resources if this was the last instance
        _LOGGER.info("🛑 No more instances left. Removing frontend resources.")

        frontend_registration = ChoreCardRegistration(hass)
        await frontend_registration.async_unregister()  # ✅ Unregister Lovelace
        _LOGGER.info("✅ Unregistered Chore Card frontend.")

        # ✅ Remove Lovelace resource entry
        if "lovelace" in hass.data:
            resources = hass.data["lovelace"].resources
            js_url = "/hacsfiles/chore-card/chore-card.js"

            for resource in list(resources.async_items()):
                if resource["url"] == js_url:
                    _LOGGER.warning(f"🚨 Removing Lovelace resource: {resource['url']}")
                    await resources.async_delete_item(resource["id"])
                    _LOGGER.info("✅ Successfully removed Lovelace resource.")
                    break  # ✅ Stop after removing the first match

        # ✅ Remove the frontend files from `/www/community/chore_card/`
        frontend_dest = hass.config.path("www/community/chore_card")

        def remove_frontend_files():
            """Delete the Chore Card frontend directory."""
            if os.path.exists(frontend_dest):
                _LOGGER.info(f"🗑️ Removing frontend folder: {frontend_dest}")
                shutil.rmtree(frontend_dest, ignore_errors=True)

        await hass.async_add_executor_job(remove_frontend_files)
        _LOGGER.info("✅ Successfully removed frontend files.")

        # ✅ Remove the update service
        if hass.services.has_service(DOMAIN, "update"):
            hass.services.async_remove(DOMAIN, "update")
            _LOGGER.info("✅ Removed `chore_card.update` service.")
        else:
            _LOGGER.info(
                "ℹ️ `chore_card.update` service was not found, skipping removal."
            )

        return unload_result

    except Exception as e:
        _LOGGER.error(f"❌ Error while unloading Chore Card: {e}")
        return False
