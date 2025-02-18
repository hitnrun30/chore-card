"""Chore Card Integration for Home Assistant."""
import logging
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.discovery import async_load_platform

DOMAIN = "chore_card"
LOGGER = logging.getLogger(__name__)

async def async_setup(hass: HomeAssistant, config):
    """Set up Chore Card integration from YAML."""
    hass.data.setdefault(DOMAIN, {})

    LOGGER.info("Setting up Chore Card integration.")

    # Ensure sensor gets registered
    hass.async_create_task(async_load_platform(hass, "sensor", DOMAIN, {}, config))

    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up Chore Card from a config entry."""
    LOGGER.info("Setting up Chore Card config entry.")

    hass.data.setdefault(DOMAIN, {})

    # Forward setup to the sensor platform
    hass.async_create_task(hass.config_entries.async_forward_entry_setup(entry, "sensor"))

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Unload a config entry."""
    LOGGER.info("Unloading Chore Card integration.")

    return await hass.config_entries.async_forward_entry_unload(entry, "sensor")
