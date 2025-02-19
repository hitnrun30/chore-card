"""Chore Card Integration for Home Assistant."""
from __future__ import annotations

import logging
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry

from .const import DOMAIN
from .frontend import ChoreCardRegistration

LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Chore Card from a config entry."""
    LOGGER.info(f"Setting up Chore Card integration for {entry.entry_id}")

    hass.data.setdefault(DOMAIN, {})

    # Store the config entry
    hass.data[DOMAIN][entry.entry_id] = entry.data

    # Forward setup to the sensor platform
    hass.async_create_task(
        hass.config_entries.async_forward_entry_setup(entry, "sensor")
    )

    # Register a service to update the sensor from the frontend
    async def handle_update(call):
        """Handle frontend updates to the sensor."""
        entity_id = call.data.get("entity_id")
        new_state = call.data.get("state", "active")
        new_attributes = call.data.get("attributes", {})

        sensor = hass.states.get(entity_id)
        if sensor:
            LOGGER.info(f"Updating {entity_id} - State: {new_state}, Attributes: {new_attributes}")
            hass.states.async_set(entity_id, new_state, new_attributes)
        else:
            LOGGER.warning(f"Entity {entity_id} not found. Cannot update.")

    hass.services.async_register(DOMAIN, "update", handle_update)

    # Register custom cards
    cards = ChoreCardRegistration(hass)
    await cards.async_register()

    LOGGER.info("Chore Card Component Setup Completed")

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    LOGGER.info(f"Unloading Chore Card integration for {entry.entry_id}")

    # Remove stored data
    hass.data[DOMAIN].pop(entry.entry_id, None)

    # Remove the service
    hass.services.async_remove(DOMAIN, "update")

    return await hass.config_entries.async_forward_entry_unload(entry, "sensor")
