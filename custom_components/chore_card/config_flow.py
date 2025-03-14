"""Config flow for Chore Card integration."""

import logging
import os
import shutil
import time
import voluptuous as vol
from homeassistant import config_entries

from .frontend import ChoreCardRegistration
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from . import async_unload_entry  # ✅ Import from __init__.py

VERSION = 1
_LOGGER = logging.getLogger(__name__)
from .const import DOMAIN


class ChoreCardConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Chore Card."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial setup step for the Chore Card integration."""
        errors = {}

        # ✅ Generate a default name based on timestamp
        timestamp_id = int(time.time())
        default_name = f"Chore Card {timestamp_id}"

        if user_input is not None:
            integration_name = user_input["integration_name"].strip()

            # ✅ Convert user input into a valid entity_id (lowercase, underscores)
            entity_id = f"sensor.{integration_name.lower().replace(' ', '_')}"

            # ✅ Ensure the entity_id is unique
            existing_entities = {
                entry.data.get("sensor_name") for entry in self._async_current_entries()
            }

            if entity_id in existing_entities:
                errors["integration_name"] = "name_exists"
            else:
                _LOGGER.info(f"✅ Creating Chore Card config entry: {integration_name} ({entity_id})")
                return self.async_create_entry(
                    title=integration_name,  # ✅ Exact user input as friendly name
                    data={"sensor_name": entity_id},  # ✅ Entity ID (fixed format)
                )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {vol.Required("integration_name", default=default_name): str}
            ),
            errors=errors,
        )

    async def async_remove_entry(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Handle complete removal of Chore Card, includin`g frontend and Lovelace."""
        _LOGGER.info(f"🛑 Removing Chore Card config entry: {entry.entry_id}")

        # ✅ Step 1: Unregister frontend
        frontend_registration = ChoreCardRegistration(hass)
        await frontend_registration.async_unregister()

        # ✅ Step 2: Remove stored data
        hass.data[DOMAIN].pop(entry.entry_id, None)

        # ✅ Step 3: Remove frontend directory
        frontend_dest = hass.config.path("www/community/chore-card")

        def remove_frontend_files():
            """Delete the Chore Card frontend directory."""
            if os.path.exists(frontend_dest):
                _LOGGER.info(f"🗑️ Removing frontend folder: {frontend_dest}")
                shutil.rmtree(frontend_dest, ignore_errors=True)

        await hass.async_add_executor_job(remove_frontend_files)
        _LOGGER.info("✅ Successfully removed frontend files.")
