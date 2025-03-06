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

import os
import shutil
import logging
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

DOMAIN = "chore_card"

async def async_setup(hass: HomeAssistant, config: dict):
    """Set up the Chore Card integration (global setup)."""
    _LOGGER.info("🛠️ Setting up Chore Card integration (global setup)")

    # Define source and destination paths for frontend files
    frontend_source = hass.config.path("custom_components/chore_card/frontend")
    frontend_dest = hass.config.path("www/community/chore_card")

    async def ensure_directory():
        """Ensure the target directories exist."""
        community_dir = hass.config.path("www/community")

        try:
            # ✅ Ensure /www/community exists
            if not os.path.exists(community_dir):
                os.makedirs(community_dir, exist_ok=True)
                _LOGGER.info(f"✅ Created community directory: {community_dir}")

            # ✅ Ensure /www/community/chore_card exists
            if not os.path.exists(frontend_dest):
                os.makedirs(frontend_dest, exist_ok=True)
                _LOGGER.info(f"✅ Created frontend destination folder: {frontend_dest}")
        except Exception as e:
            _LOGGER.error(f"❌ Failed to create directories: {e}")

    async def copy_frontend_files():
        """Copy frontend files asynchronously to avoid blocking the event loop."""
        try:
            # ✅ Verify source directory exists
            if not os.path.exists(frontend_source):
                _LOGGER.error(f"❌ Frontend source folder not found: {frontend_source}")
                return False  # Prevent further execution if files are missing

            files = await hass.async_add_executor_job(os.listdir, frontend_source)
            for filename in files:
                src_path = os.path.join(frontend_source, filename)
                dest_path = os.path.join(frontend_dest, filename)

                if os.path.isfile(src_path):
                    should_copy = not os.path.exists(dest_path) or (
                        os.path.getmtime(src_path) > os.path.getmtime(dest_path)
                    )

                    if should_copy:
                        await hass.async_add_executor_job(shutil.copy, src_path, dest_path)
                        _LOGGER.info(f"✅ Copied {filename} to {frontend_dest}")

            _LOGGER.info("🎉 Chore Card frontend files copied successfully!")
        except Exception as e:
            _LOGGER.error(f"❌ Failed to copy Chore Card frontend files: {e}")

    # ✅ Ensure directory creation runs properly before copying
    await hass.async_add_executor_job(ensure_directory)
    await hass.async_add_executor_job(copy_frontend_files)

    return True  # ✅ Ensure Home Assistant knows the setup was successful

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

    # ✅ Register the update service only if it doesn’t exist
    if not hass.services.has_service(DOMAIN, "update"):
        @callback
        def handle_update(call: ServiceCall) -> None:
            """Handle frontend updates to the sensor."""
            entity_id = call.data.get("entity_id")
            new_state = call.data.get("state", "active")
            new_attributes = call.data.get("attributes", {})

            sensor = hass.states.get(entity_id)  # ✅ Ensure the sensor exists in the state machine

            if sensor:
                _LOGGER.info(f"Updating {entity_id} - State: {new_state}, Attributes: {new_attributes}")

                # Update Home Assistant state machine
                hass.states.async_set(entity_id, new_state, new_attributes)
            else:
                _LOGGER.warning(f"Entity {entity_id} not found. Cannot update.")

        hass.services.async_register(DOMAIN, "update", handle_update)
        _LOGGER.info("Registered service: chore_card.update")

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
