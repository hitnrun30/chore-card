"""Chore-Card Frontend"""

import logging
import os
import pathlib
import shutil

from homeassistant import core
from homeassistant.helpers.event import async_call_later
from homeassistant.components.http import StaticPathConfig

from ..const import URL_BASE, CHORE_CARDS, DOMAIN

_LOGGER = logging.getLogger(__name__)


class ChoreCardRegistration:
    def __init__(self, hass: core.HomeAssistant):
        self.hass = hass

    async def async_register(self):
        """Register Chore Card frontend in Lovelace and remove old resources."""
        _LOGGER.info("🛠️ Registering Chore Card frontend in Lovelace")

        try:
            # ✅ Step 1: Get the version from `manifest.json`
            manifest_version = self.hass.data["integrations"][DOMAIN].manifest[
                "version"
            ]
            self.hass.data["chore_card_version"] = manifest_version

            await self.async_register_chore_path()

            # ✅ Step 2: Only proceed if Lovelace is in "storage" mode
            if self.hass.data["lovelace"].mode == "storage":
                await self.async_wait_for_lovelace_resources()

                # ✅ Step 3: Remove any outdated or incorrect resource entries
                resources = self.hass.data["lovelace"].resources
                correct_url = f"/hacsfiles/chore-card/chore-card.js?v={manifest_version}"  # ✅ Correct versioned URL
                incorrect_urls = [
                    "/chore_card/chore-card.js?v=1.0.0",  # ❌ Old incorrect entry
                    "/chore_card/chore-card.js",  # ❌ Any unversioned legacy entries
                ]

                # ✅ Remove any outdated resource entries
                for resource in list(resources.async_items()):
                    if resource["url"] in incorrect_urls:
                        _LOGGER.info(
                            f"🔄 Removing outdated resource entry: {resource['url']}"
                        )
                        await resources.async_delete_item(resource["id"])

                # ✅ Prevent duplicate registrations
                existing_urls = {res.get("url") for res in resources.async_items()}
                if correct_url in existing_urls:
                    _LOGGER.info(
                        f"✅ Chore Card JavaScript already registered with version: {manifest_version}"
                    )
                    return

                # ✅ Register the JavaScript file with version
                await resources.async_create_item(
                    {"res_type": "module", "url": correct_url}
                )
                _LOGGER.info(f"🎉 Chore Card JS Registered with version: {correct_url}")

        except Exception as e:
            _LOGGER.error(f"❌ Failed to register Chore Card frontend: {e}")

    # install card resources
    async def async_register_chore_path(self):
        """Register custom cards path if not already registered."""
        try:
            frontend_path = self.hass.config.path(
                "www/community/chore_card"
            )  # ✅ Correct path

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
                _LOGGER.error(
                    "Lovelace resources failed to load after multiple attempts."
                )
                return

            if self.hass.data["lovelace"].resources.loaded:
                await self.async_register_chore_cards()
            else:
                _LOGGER.debug(
                    "Lovelace resources not loaded yet, retrying in %d seconds...",
                    delay,
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
        """Remove Lovelace resources and frontend files when integration is removed."""
        _LOGGER.info("🗑️ Unregistering Chore Card frontend resources and files")

        if (
            "lovelace" in self.hass.data
            and self.hass.data["lovelace"].mode == "storage"
        ):
            resources = self.hass.data["lovelace"].resources
            js_url = f"/hacsfiles/chore-card/chore-card.js?v={self.hass.data.get('chore_card_version', '2.0.0')}"

            # ✅ Remove Lovelace resource
            for resource in resources.async_items():
                if resource["url"] == js_url:
                    _LOGGER.warning(f"🚨 Removing Lovelace resource: {resource['url']}")
                    await resources.async_delete_item(resource["id"])

        # ✅ Step 2: Remove frontend files from www/community/
        frontend_path = self.hass.config.path("www/community/chore_card")

        def remove_frontend_files():
            """Delete the frontend directory for Chore Card."""
            if os.path.exists(frontend_path):
                _LOGGER.info(f"🗑️ Removing frontend folder: {frontend_path}")
                shutil.rmtree(frontend_path, ignore_errors=True)

        await self.hass.async_add_executor_job(remove_frontend_files)

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
                filename
                for filename in os.listdir(path)
                if filename and filename.endswith(".gz")
            ]

            for file in gzip_files:
                original_file = file.replace(".gz", "")
                original_file_path = os.path.join(path, original_file)

                if os.path.exists(original_file_path) and os.path.getmtime(
                    original_file_path
                ) > os.path.getmtime(os.path.join(path, file)):
                    _LOGGER.debug(f"Removing outdated gzip file: {file}")
                    os.remove(os.path.join(path, file))
        except Exception as e:
            _LOGGER.error("Failed to remove gzip file: %s", e)
