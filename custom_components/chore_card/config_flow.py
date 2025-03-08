"""Config flow for Chore Card integration."""
import logging
import voluptuous as vol
from homeassistant import config_entries

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

class ChoreCardConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Chore Card."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        _LOGGER.debug(f"Received user input: {user_input}")  # ✅ Debugging log
        
        if user_input:  # ✅ Fix: Accept empty dict `{}` gracefully
            return self.async_create_entry(title="Chore Card", data=user_input)

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({}),
        )
