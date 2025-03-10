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
        """Handle the initial step."""
        _LOGGER.debug(f"Received user input: {user_input}")  # ✅ Debugging log

        if user_input is None:  # ✅ Fix: Correctly detect initial form submission
            return self.async_show_form(
                step_id="user",
                data_schema=vol.Schema({}),
            )

        _LOGGER.info("✅ Creating Chore Card config entry.")
        return self.async_create_entry(
            title="Chore Card", data={}
        )  # ✅ Always create entry

    async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Handle complete removal of Chore Card, including frontend and Lovelace."""
        _LOGGER.info(f"🛑 Removing Chore Card config entry: {entry.entry_id}")

        # ✅ Step 1: Fully unload integration
        await async_unload_entry(hass, entry)

        # ✅ Step 2: Ensure frontend files and Lovelace resource are removed
        frontend_registration = ChoreCardRegistration(hass)
        await frontend_registration.async_unregister()

        # ✅ Step 3: Force delete frontend directory
        frontend_dest = hass.config.path("www/community/chore_card")

        def remove_frontend_files():
            """Force delete the Chore Card frontend directory."""
            if os.path.exists(frontend_dest):
                _LOGGER.info(f"🗑️ Removing frontend folder: {frontend_dest}")
                shutil.rmtree(frontend_dest, ignore_errors=True)

        await hass.async_add_executor_job(remove_frontend_files)
