#!/usr/bin/env python3
#
# Copyright (C) 2023 Rackslab
#
# This file is part of Slurm-web.
#
# Slurm-web is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# Slurm-web is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with Slurm-web.  If not, see <https://www.gnu.org/licenses/>.

import logging

from rfl.utils.flask.tokens import RFLTokenizedWebApp
from racksdb.web.api import RacksDBRESTAPIBlueprint

from . import SlurmwebApp
from ..views import SlurmwebAppRoute
from ..views import agent as views
from ..auth import AuthenticatorFactory
from ..events import EventsManager

logger = logging.getLogger(__name__)


class SlurmwebAppAgent(SlurmwebApp, RFLTokenizedWebApp):

    NAME = "slurm-web-agent"
    SITE_CONFIGURATION = "/etc/slurm-web/agent.ini"
    SETTINGS_DEFINITION = "/usr/share/slurm-web/agent.yml"
    VIEWS = {
        SlurmwebAppRoute("/version", views.version),
        SlurmwebAppRoute("/login", views.login, methods=["POST"]),
        SlurmwebAppRoute("/streams/jobs", views.stream_jobs),
        SlurmwebAppRoute("/api/<path:query>", views.slurmrest),
    }

    def __init__(self, args):
        SlurmwebApp.__init__(self, args)
        self.register_blueprint(
            RacksDBRESTAPIBlueprint(
                db="/home/remi/Documents/git/products/RacksDB/examples/db",
                ext="/etc/racksdb/extensions.yml",
                schema="/home/remi/Documents/git/products/RacksDB/schema/racksdb.yml",
            ),
            url_prefix="/api/racksdb",
        )
        self.authenticator = AuthenticatorFactory.get(
            self.settings.authentication.method, self.settings
        )
        if self.settings.policy.roles.exists():
            logger.debug("Select RBAC site roles policy %s", self.settings.policy.roles)
            selected_roles_policy_path = self.settings.policy.roles
        else:
            logger.debug(
                "Select default RBAC vendor roles policy %s",
                self.settings.policy.vendor_roles,
            )
            selected_roles_policy_path = self.settings.policy.vendor_roles
        RFLTokenizedWebApp.__init__(
            self,
            audience=self.settings.jwt.audience,
            algorithm=self.settings.jwt.algorithm,
            key=self.settings.jwt.key,
            policy=self.settings.policy.definition,
            roles=selected_roles_policy_path,
        )
        self.events = EventsManager("localhost", 6379, "usr:job")
