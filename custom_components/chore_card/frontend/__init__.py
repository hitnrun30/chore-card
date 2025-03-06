"""Chore-Card Frontend"""

import logging
import os
import pathlib

from homeassistant import core
from homeassistant.helpers.event import async_call_later
from homeassistant.components.http import StaticPathConfig

from ..const import URL_BASE, CHORE_CARDS, DOMAIN
_LOGGER = logging.getLogger(__name__)


class ChoreCardRegistration:
    def __init__(self, hass: core.HomeAssistant):
        self.hass = hass

    async def async_register(self):
        """Register Chore Card frontend files in Lovelace with versioning."""
        _LOGGER.info("🛠️ Registering Chore Card frontend in Lovelace")

        try:
            # ✅ Step 1: Get the version from `manifest.json`
            manifest_version = self.hass.data["integrations"][DOMAIN].manifest["version"]
            self.hass.data["chore_card_version"] = manifest_version

            await self.async_register_chore_path()

            # ✅ Step 2: Only proceed if Lovelace is in "storage" mode
            if self.hass.data["lovelace"].mode == "storage":
                await self.async_wait_for_lovelace_resources()

                # ✅ Step 3: Remove any old duplicate resource paths
                resources = self.hass.data["lovelace"].resources
                base_url = "/hacsfiles/chore-card/chore-card.js"
                versioned_url = f"{base_url}?v={manifest_version}"  # ✅ Append version

                # ✅ Remove old resource entries without the correct version
                for resource in list(resources.async_items()):
                    if resource["url"].startswith(base_url) and resource["url"] != versioned_url:
                        _LOGGER.info(f"🔄 Removing old resource entry: {resource['url']}")
                        await resources.async_delete_item(resource["id"])

                # ✅ Prevent duplicate registrations
                existing_urls = {res.get("url") for res in resources.async_items()}
                if versioned_url in existing_urls:
                    _LOGGER.info(f"✅ Chore Card JavaScript already registered with version: {manifest_version}")
                    return

                # ✅ Register the JavaScript file with version
                await resources.async_create_item({"res_type": "module", "url": versioned_url})
                _LOGGER.info(f"🎉 Chore Card JS Registered with version: {versioned_url}")

        except Exception as e:
            _LOGGER.error(f"❌ Failed to register Chore Card frontend: {e}")

    # install card resources
    async def async_register_chore_path(self):
        """Register custom cards path if not already registered."""
        try:
            frontend_path = self.hass.config.path("www/community/chore_card")  # ✅ Correct path
            
            await self.hass.http.async_register_static_paths(
                [StaticPathConfig(URL_BASE, frontend_path, False)]
            )

            _LOGGER.debug("Registered chore-card path from %s", frontend_path)
        except RuntimeError:
            _LOGGER.debug("Chore-card static path already registered")

    async def async_wait_for_lovelace_resources(self):
        """Wait for Lovelace resources to load before registering cards."""
        retries = 10  # ✅ Max retries to prevent infinite loop
        delay = 5  # ✅ Wait time in seconds

        async def check_lovelace_resources_loaded(now):
            nonlocal retries
            if retries <= 0:
                _LOGGER.error("Lovelace resources failed to load after multiple attempts.")
                return

            if self.hass.data["lovelace"].resources.loaded:
                await self.async_register_chore_cards()
            else:
                _LOGGER.debug(
                    "Lovelace resources not loaded yet, retrying in %d seconds...", delay
                )
                retries -= 1
                async_call_later(self.hass, delay, check_lovelace_resources_loaded)

        await check_lovelace_resources_loaded(0)

    async def async_register_chore_cards(self):
        _LOGGER.debug("Installing Lovelace resources for chore-card cards")

        # Get resources already registered
        chore_card_resources = [
            resource
            for resource in self.hass.data["lovelace"].resources.async_items()
            if resource["url"].startswith(URL_BASE)
        ]

        for card in CHORE_CARDS:
            url = f"{URL_BASE}/{card.get('filename')}"

            if not url.endswith(".js"):
                _LOGGER.debug("Skipping non-JS file: %s", url)
                continue

            card_registered = False

            for res in chore_card_resources:
                if self.get_resource_path(res["url"]) == url:
                    card_registered = True
                    # check version
                    if self.get_resource_version(res["url"]) != card.get("version"):
                        # Update card version
                        _LOGGER.debug(
                            "Updating %s to version %s",
                            card.get("name"),
                            card.get("version"),
                        )
                        await self.hass.data["lovelace"].resources.async_update_item(
                            res.get("id"),
                            {
                                "res_type": "module",
                                "url": url + "?v=" + card.get("version"),
                            },
                        )
                        # Remove old gzipped files
                        await self.async_remove_gzip_files()
                    else:
                        _LOGGER.debug(
                            "%s already registered as version %s",
                            card.get("name"),
                            card.get("version"),
                        )

            if not card_registered:
                _LOGGER.debug(
                    "Registering %s as version %s",
                    card.get("name"),
                    card.get("version"),
                )
                await self.hass.data["lovelace"].resources.async_create_item(
                    {"res_type": "module", "url": url + "?v=" + card.get("version")}
                )

    def get_resource_path(self, url: str):
        return url.split("?")[0]

    def get_resource_version(self, url: str):
        try:
            return url.split("?")[1].replace("v=", "")
        except Exception:
            return 0

    async def async_unregister(self):
        """Remove Lovelace resources when the integration is removed."""
        if self.hass.data["lovelace"].mode == "storage":
            for card in CHORE_CARDS:
                url = f"{URL_BASE}/{card.get('filename')}"
                chore_card_resources = [
                    resource
                    for resource in self.hass.data["lovelace"].resources.async_items()
                    if str(resource["url"]).startswith(url)
                ]
                for resource in chore_card_resources:
                    await self.hass.data["lovelace"].resources.async_delete_item(resource.get("id"))

            _LOGGER.info("Removed Lovelace resources for Chore Card")

            # ✅ Remove frontend files as well
            frontend_path = self.hass.config.path("www/community/chore_card")
            if os.path.exists(frontend_path):
                try:
                    for file in os.listdir(frontend_path):
                        os.remove(os.path.join(frontend_path, file))
                    _LOGGER.info("Removed Chore Card frontend files.")
                except Exception as e:
                    _LOGGER.error("Failed to remove frontend files: %s", e)

    async def async_remove_gzip_files(self):
        await self.hass.async_add_executor_job(self.remove_gzip_files)

    def remove_gzip_files(self):
        """Remove outdated gzip-compressed files."""
        path = self.hass.config.path("www/community/chore_card")

        if not os.path.exists(path):
            _LOGGER.warning("Frontend path does not exist: %s", path)
            return

        try:
            gzip_files = [
                filename for filename in os.listdir(path) if filename and filename.endswith(".gz")
            ]

            for file in gzip_files:
                original_file = file.replace(".gz", "")
                original_file_path = os.path.join(path, original_file)

                if (
                    os.path.exists(original_file_path) and
                    os.path.getmtime(original_file_path) > os.path.getmtime(os.path.join(path, file))
                ):
                    _LOGGER.debug(f"Removing outdated gzip file: {file}")
                    os.remove(os.path.join(path, file))
        except Exception as e:
            _LOGGER.error("Failed to remove gzip file: %s", e)

