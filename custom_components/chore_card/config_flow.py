"""Config flow for Chore Card integration."""

import logging
import voluptuous as vol
from homeassistant import config_entries

from .const import DOMAIN
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
        """Handle removal of a config entry."""
        _LOGGER.info(f"🛑 Removing Chore Card config entry: {entry.entry_id}")
        await async_unload_entry(hass, entry)
