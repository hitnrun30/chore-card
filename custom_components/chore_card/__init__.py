from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_component import EntityComponent
from homeassistant.helpers.typing import ConfigType
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers import discovery
import logging

DOMAIN = "chore_card"

_LOGGER = logging.getLogger(__name__)

async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Chore Card integration."""
    hass.data[DOMAIN] = {}

    # Register services
    async def handle_reset_chores(call):
        """Reset chores for all registered cards."""
        for entity in hass.data[DOMAIN].values():
            await entity.reset_chores()

    hass.services.async_register(DOMAIN, "reset_chores", handle_reset_chores)

    # Discover platform (e.g., sensor)
    await discovery.async_load_platform(hass, "sensor", DOMAIN, {}, config)

    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up the Chore Card from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = entry.data
    
    # Forward setup to the sensor platform
    hass.async_create_task(
        hass.config_entries.async_forward_entry_setup(entry, "sensor")
    )

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    hass.data[DOMAIN].pop(entry.entry_id)
    return await hass.config_entries.async_forward_entry_unload(entry, "sensor")
