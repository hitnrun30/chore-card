"""Config flow for Chore Card integration."""

import logging
import os
import shutil
import voluptuous as vol
from homeassistant import config_entries

from .const import DOMAIN
from .frontend import ChoreCardRegistration
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from . import async_unload_entry  # ✅ Import from __init__.py


_LOGGER = logging.getLogger(__name__)


class ChoreCardConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Chore Card."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial setup step for the Chore Card integration."""
        errors = {}

        # ✅ Generate a temporary default name (before we rename it)
        temp_name = f"Chore Card"

        if user_input is not None:
            # ✅ Create the entry first (Home Assistant generates the entry_id automatically)
            _LOGGER.info("✅ Creating Chore Card config entry...")
            entry = await self.async_create_entry(title=temp_name, data={})

            # ✅ Get the generated entry ID and rename the integration
            if entry:
                new_name = f"sensor.chore_card_{entry.entry_id}"
                _LOGGER.info(f"🔄 Renaming integration to: {new_name}")
                self.hass.config_entries.async_update_entry(entry, title=new_name)

            return entry  # ✅ Return the entry after renaming

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {vol.Required("integration_name", default=temp_name): str}
            ),
            errors=errors,
        )

    async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Handle complete removal of Chore Card, including frontend and Lovelace."""
        _LOGGER.info(f"🛑 Removing Chore Card config entry: {entry.entry_id}")

        # ✅ Step 1: Fully unload integration
        await async_unload_entry(hass, entry)

        # ✅ Step 2: Ensure frontend files and Lovelace resource are removed
        frontend_registration = ChoreCardRegistration(hass)
        await frontend_registration.async_unregister()

        # ✅ Step 3: Force delete frontend directory
        frontend_dest = hass.config.path("www/community/chore-card")

        def remove_frontend_files():
            """Force delete the Chore Card frontend directory."""
            if os.path.exists(frontend_dest):
                _LOGGER.info(f"🗑️ Removing frontend folder: {frontend_dest}")
                shutil.rmtree(frontend_dest, ignore_errors=True)

        await hass.async_add_executor_job(remove_frontend_files)
