import logging

_LOGGER = logging.getLogger(__name__)

async def async_setup(hass, config):
    _LOGGER.warning("🚀 Chore Card async_setup was called!")
    return True

async def async_setup_entry(hass, entry):
    _LOGGER.warning("🚀 Chore Card async_setup_entry was called!")
    return True
